import {describe,expect,it} from "vitest";
import {postgresTlsOptions,safePostgresUri} from "../src/lib/database-tls";

const url="postgresql://caremap:secret@database.example.org:5432/caremap?sslmode=require";
const ca="-----BEGIN CERTIFICATE-----\nTEST_ONLY\n-----END CERTIFICATE-----";
describe("Verified database transport",()=>{
  it("removes URL-side TLS options so client TLS policy remains authoritative",()=>{
    expect(safePostgresUri(url)).not.toContain("sslmode");
    expect(()=>safePostgresUri("https://example.org")).toThrow(/PostgreSQL URL/);
  });
  it("requires trusted certificate for remote and production instances",()=>{
    expect(()=>postgresTlsOptions(url,undefined,true)).toThrow(/AIVEN_CA_CERT/);
    expect(()=>postgresTlsOptions(url,undefined,false)).toThrow(/AIVEN_CA_CERT/);
    expect(()=>postgresTlsOptions(url,"not a certificate",true)).toThrow(/PEM/);
    const config=postgresTlsOptions(url,ca,true);
    expect(config).toMatchObject({ca,rejectUnauthorized:true});
  });
  it("allows only nonproduction loopback to skip encrypted transport",()=>{
    expect(postgresTlsOptions("postgresql://localhost:5432/ci",undefined,false)).toBe(false);
    expect(()=>postgresTlsOptions("postgresql://localhost:5432/ci",undefined,true))
      .toThrow(/AIVEN_CA_CERT/);
    expect(()=>postgresTlsOptions("postgresql://10.1.1.2:5432/ci",undefined,false))
      .toThrow(/AIVEN_CA_CERT/);
  });
});
