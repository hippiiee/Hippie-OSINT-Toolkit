FROM python:3.10-slim

RUN apt-get update && apt-get install -y git

WORKDIR /app

RUN git clone https://github.com/hippiiee/osgint /app/social_networks/github/project_source

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN pip3 install pipx && \
    pipx ensurepath && \
    pipx install ghunt && \
    ln -s ~/.local/bin/ghunt /usr/local/bin/ghunt

COPY . .

ARG GHUNT_CREDS_DATA
RUN mkdir -p ~/.malfrats/ghunt && \
    echo "$GHUNT_CREDS_DATA" > ~/.malfrats/ghunt/creds.m

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:5000", "wsgi:app"]