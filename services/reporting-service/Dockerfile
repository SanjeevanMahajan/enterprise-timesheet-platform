FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Writable directory for SQLite analytics database
RUN mkdir -p /app/data

EXPOSE 8002

CMD ["python", "-u", "main.py"]
