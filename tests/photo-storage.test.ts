import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {cloudinaryIsConfigured,PhotoStorageError,uploadPhotoToCloudinary} from "../src/lib/photo-storage";

const entityId="a4c1e24d-4898-4c8e-b983-f31b7211b300";

function jpeg(){
  return new File([new Uint8Array([0xff,0xd8,0xff,0xe0,0,0,0])],"field.jpg",{type:"image/jpeg"});
}

describe("Cloudinary photo uploads",()=>{
  beforeEach(()=>{
    vi.stubEnv("CLOUDINARY_CLOUD_NAME","testcloud");
    vi.stubEnv("CLOUDINARY_API_KEY","test-key");
    vi.stubEnv("CLOUDINARY_API_SECRET","secret-value");
  });
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

  it("requires all three server credentials",()=>{
    expect(cloudinaryIsConfigured()).toBe(true);
    vi.stubEnv("CLOUDINARY_API_SECRET","");
    expect(cloudinaryIsConfigured()).toBe(false);
  });

  it("rejects invalid file contents and never connects to Cloudinary",async()=>{
    const fetchMock=vi.fn();
    vi.stubGlobal("fetch",fetchMock);
    await expect(uploadPhotoToCloudinary(new File(["not an image"],"fake.jpg",{type:"image/jpeg"}),"report",entityId))
      .rejects.toThrow(/format does not match/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses authenticated server-only upload and returns the secure delivery URL",async()=>{
    const secureUrl="https://res.cloudinary.com/testcloud/image/upload/v10/care-map/report/pic.jpg";
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      secure_url:secureUrl,public_id:"care-map/report/test",resource_type:"image"
    }),{status:200,headers:{"content-type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    const uploaded=await uploadPhotoToCloudinary(jpeg(),"report",entityId);
    expect(uploaded.url).toBe(secureUrl);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url,options]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(url).toBe("https://api.cloudinary.com/v1_1/testcloud/image/upload");
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string,string>).Authorization).toMatch(/^Basic /);
    const body=options.body as FormData;
    expect(body.get("public_id")).toMatch(/^care-map\/report\//);
    expect(body.get("overwrite")).toBe("false");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("rejects credential errors without exposing raw upstream responses",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("secret details",{status:401})));
    await expect(uploadPhotoToCloudinary(jpeg(),"report",entityId))
      .rejects.toThrow(/authorization failed/i);
  });

  it("rejects invalid target IDs",async()=>{
    await expect(uploadPhotoToCloudinary(jpeg(),"report","../other")).rejects.toBeInstanceOf(PhotoStorageError);
  });
});
