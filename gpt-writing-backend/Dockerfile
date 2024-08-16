FROM python:3.12.4-slim

WORKDIR /app/backend-server

COPY . .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

#8088
EXPOSE 5000
CMD ["python", "server.py"]