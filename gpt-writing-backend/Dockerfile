FROM python:3.9-slim-buster

WORKDIR /app/backend-server

COPY . .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

#8088
EXPOSE 5000
CMD ["python", "server.py"]