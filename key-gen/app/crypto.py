from nacl.signing import SigningKey, VerifyKey
from nacl.encoding import Base64Encoder
from nacl.exceptions import BadSignatureError

def generate_ed25519_keypair():

    # generate key
    signing_key = SigningKey.generate()
    verify_key = signing_key.verify_key

    # encode to Base64 strings for transport
    private_b64 = signing_key.encode(encoder=Base64Encoder).decode("utf-8")
    public_b64 = verify_key.encode(encoder=Base64Encoder).decode("utf-8")

    return public_b64, private_b64

def sign_ed25519(private_key_b64: str, message: str) -> str:
    signing_key = SigningKey(private_key_b64.encode("utf-8"), encoder=Base64Encoder)
    message_bytes = message.encode("utf-8")
    signature = signing_key.sign(message_bytes).signature
    return Base64Encoder.encode(signature).decode("utf-8")


def verify_ed25519(public_key_b64: str, message: str, signature_b64: str) -> bool:
    verify_key = VerifyKey(public_key_b64.encode("utf-8"), encoder=Base64Encoder)
    message_bytes = message.encode("utf-8")
    signature_bytes = Base64Encoder.decode(signature_b64.encode("utf-8"))
    try:
        verify_key.verify(message_bytes, signature_bytes)
        return True
    except BadSignatureError:
        return False