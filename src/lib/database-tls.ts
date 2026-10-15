/**
 * Aiven/PostgreSQL TLS policy shared across runtime pools and migration clients.
 * No fallback to rejectUnauthorized:false for public Internet databases.
 * Plain TCP is allowed only for localhost in a non-production development/test runtime.
 */
export function safePostgresUri(connectionString:string){
  const uri=new URL(connectionString);
  if(!["postgres:","postgresql:"].includes(uri.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL URL.");
  for(const key of ["sslmode","sslrootcert","sslcert","sslkey"]){
    uri.searchParams.delete(key);
  }
  return uri.toString();
}

export function postgresTlsOptions(connectionString:string,caCert?:string,production=process.env.NODE_ENV==="production"){
  const uri=new URL(connectionString);
  if(!["postgres:","postgresql:"].includes(uri.protocol))
    throw new Error("Database URL must use postgresql://.");
  const ca=caCert?.trim().replace(/\\n/g,"\n");
  if(ca){
    if(!ca.includes("-----BEGIN CERTIFICATE-----")||!ca.includes("-----END CERTIFICATE-----"))
      throw new Error("AIVEN_CA_CERT must be a valid PEM certificate.");
    return {ca,rejectUnauthorized:true} as const;
  }
  const localHost=["localhost","127.0.0.1","::1","[::1]"].includes(uri.hostname);
  if(!production&&localHost)return false;
  throw new Error("Verified database TLS requires AIVEN_CA_CERT for remote/production PostgreSQL connections.");
}
