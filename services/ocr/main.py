import numpy as np
import cv2
from fastapi import FastAPI, File, HTTPException, UploadFile
from paddleocr import PaddleOCR

app = FastAPI()
ocr = PaddleOCR(use_angle_cls=True, lang="pt", show_log=False)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/extract")
async def extract(file: UploadFile = File(...)) -> dict:
    contents = await file.read()
    image = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Não foi possível decodificar a imagem")

    result = ocr.ocr(image, cls=True)
    lines = [line[1][0] for page in result if page for line in page]

    return {"text": "\n".join(lines)}
