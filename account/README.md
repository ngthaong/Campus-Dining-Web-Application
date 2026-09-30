# account-service
## Running this program

### 1. Install Dependencies

Ensure you have:
- Go 1.20+
- Docker OR some other way of running postgres

### 1. (Optional) Start a database server if you don't already have on running:
This command stores database files inside a directory in the user's home folder named `postgres_data`:

```
mkdir -p ~/postgres_data

docker run \
  --name sigver-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sigver \
  -v ~/postgres_data:/var/lib/postgresql/data/pgdata \
  -p 5432:5432 \
  -d postgres:18
```
Notes:
- You may change the username, password, or version as needed.
- The database files will persist because of the mounted directory `~/postgres_data`.

### 2. Create the Database

Open a PostgreSQL shell and create the development database:

```
psql -U postgres
CREATE DATABASE account;
```
### 3. Configure the Application

Copy the example configuration:
```
cp example-config.json config.json
```

Edit config.json if necessary to match your local PostgreSQL connection information:
```
{
  "postgres_host": "localhost",
  "postgres_port": "5432",
  "postgres_user": "postgres",
  "postgres_password": "postgres",
  "postgres_db": "account",
  "jwt_secret": "super-secret-key-change-me",
  "postgres_sslmode": "disable",
  "port": "8080"
}
```

You may also override any value using environment variables:

```
POSTGRES_HOST
POSTGRES_PORT
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
POSTGRES_SSLMODE
PORT
```

### 4. Run the Server

From the repository root:

go run .

The API will start on the port specified in config.json (default: 8080).

### Working with JWT

This application returns JWT on login.
To make use of this in your application **you must** use the same JWT secret in your application
to be able to read the token's content. 

The JWT secret is set in this application with this JSON key:  
````
{
....
"jwt_secret": "super-secret-key-change-me",
....
}
````
#### Example python program that uses our JWT

````
import jwt
import requests

# -------------------------------------------------------
# CONFIG
# -------------------------------------------------------
AUTH_URL = "http://localhost:8080/user/login"
JWT_SECRET = "your-secret-here"  # MUST match the Go server's jwtSecret
JWT_ALGORITHM = "HS256"


# -------------------------------------------------------
# STEP 1 — Log in and receive JWT from Go backend
# -------------------------------------------------------
def login_and_get_token(username, password):
    payload = {
        "username": username,
        "password": password
    }

    response = requests.post(AUTH_URL, json=payload)
    print("Login response:", response.status_code, response.text)

    if response.status_code != 200:
        raise Exception("Login failed")

    return response.json()["token"]


# -------------------------------------------------------
# STEP 2 — Decode the JWT returned by Go backend
# -------------------------------------------------------
def decode_jwt(token):
    decoded = jwt.decode(
        token,
        JWT_SECRET,           # same secret Go used → []byte(jwtSecret)
        algorithms=[JWT_ALGORITHM]
    )
    return decoded


# -------------------------------------------------------
# MAIN
# -------------------------------------------------------
if __name__ == "__main__":
    # Change these to a valid user in your database
    username = "alice"
    password = "mypassword"

    print("\nRequesting JWT from Go backend...\n")
    token = login_and_get_token(username, password)

    print("\nReceived token:\n", token)

    print("\nDecoding token...\n")
    decoded_payload = decode_jwt(token)

    print("Decoded JWT payload:")
    for k, v in decoded_payload.items():
        print(f"{k}: {v}")

````

## Making Requests
### Create User

POST /user

Create a new user with a username and password.

Request Body (JSON)
````
{
"username": "alice",
"password": "mypassword"
}
````
Example Python Request
````
import requests

url = "http://localhost:8080/user"
data = {
"username": "alice",
"password": "mypassword"
}

response = requests.post(url, json=data)
print(response.status_code)
print(response.json())
````
Example Response (201 Created)
````
{
"id": 1,
"username": "alice",
"created_at": "2025-01-01T12:00:00Z"
}
````
### Get User by ID

GET /user?id={id}

Example Python Request
````
import requests

response = requests.get("http://localhost:8080/user?id=1")
print(response.status_code)
print(response.json())
````
Example Response (200 OK)
````
{
"id": 1,
"username": "alice",
"created_at": "2025-01-01T12:00:00Z"
}
````
Errors

| Status | Meaning  |
|--------|-------------|
| 400    | missing or invalid id |
| 404    | user not found |


### Get User by Username

GET /user?username={username}

Example Python Request
````
import requests

response = requests.get("http://localhost:8080/user?username=alice")
print(response.status_code)
print(response.json())

Example Response (200 OK)
{
"id": 1,
"username": "alice",
"created_at": "2025-01-01T12:00:00Z"
}
````

### User Login

POST /user/login

Login requires username + password.
If successful, a JWT token is returned.

Request Body (JSON)
````
{
"username": "alice",
"password": "mypassword"
}
````
Example Python Request
````
import requests

url = "http://localhost:8080/user/login"
data = {
"username": "alice",
"password": "mypassword"
}

response = requests.post(url, json=data)
print(response.status_code)
print(response.json())
````
Example Response (200 OK)
````
{
"token": "eyJhbGciOiJIUzI1NiIs...",
"message": "Logged in successfully"
}
````
Invalid Credentials Response (401)
````
{
"error": "Login failed. Check your credentials."
}
````
JWT Token Structure

Tokens include:
````
{
"username": "alice",
"user_id": 1,
"exp": 1735758123
}
````

Signing algorithm: HS256

Expiration: 24 hours


