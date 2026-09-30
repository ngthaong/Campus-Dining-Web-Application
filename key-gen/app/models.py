from pydantic import BaseModel

class GenerateRequest(BaseModel):
    algorithm: str

class SignRequest(BaseModel):
    private_key: str
    message: str

class VerifyRequest(BaseModel):
    public_key: str
    message: str
    signature: str


class GenerateResponse(BaseModel):
    public_key: str
    private_key: str

class SignResponse(BaseModel):
    signature: str

class VerifyResponse(BaseModel):
    valid: bool 