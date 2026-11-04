FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends python3.11 python3.11-venv python3-pip libsndfile1 ffmpeg git && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN python3.11 -m pip install --no-cache-dir -U pip && python3.11 -m pip install --no-cache-dir -r requirements.txt
COPY core.py app.py samples.py ./
ENV TTS_DATA=/data HF_HOME=/data/hf
VOLUME /data
EXPOSE 8000
CMD ["python3.11", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
