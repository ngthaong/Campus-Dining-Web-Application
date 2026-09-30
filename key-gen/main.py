from app.models import GenerateRequest, GenerateResponse, SignRequest, SignResponse, VerifyRequest, VerifyResponse
from app.crypto import generate_ed25519_keypair, sign_ed25519, verify_ed25519

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (or restrict to specific frontend URLs)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
def health():
    return {"status": "ok"}

@app.post("/generateKeyPair", response_model=GenerateResponse, tags=["keys"])
def generate_keypair(req: GenerateRequest):
    if req.algorithm.lower() != "ed25519":
        raise HTTPException(status_code=400, detail="Only Ed25519 is supported in this service.")
    public_b64, private_b64 = generate_ed25519_keypair()
    return GenerateResponse(public_key=public_b64, private_key=private_b64)

@app.post("/signData", response_model=SignResponse, tags=["sign"])
def sign_data(req: SignRequest):
    signature_b64 = sign_ed25519(req.private_key, req.message)
    return SignResponse(signature=signature_b64)

@app.post("/verifySignature", response_model=VerifyResponse, tags=["verify"])
def verify_signature(req: VerifyRequest):
    valid = verify_ed25519(req.public_key, req.message, req.signature)
    return VerifyResponse(valid=valid)