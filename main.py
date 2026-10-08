from fastapi import FastAPI

app = FastAPI()

@app.get("/products")
def get_products():
    return {"message": "Products endpoint works!"}