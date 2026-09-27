FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    python3-dev \
    libfreetype6-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git clone https://github.com/hippiiee/osgint /app/social_networks/github/project_source

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pin upstream fixes for missing cover-photo metadata, missing edit dates and JSON export.
# PyPI 2.3.4 does not include these fixes (GHunt PR #592).
RUN pip3 install pipx && \
    pipx ensurepath && \
    pipx install "ghunt @ git+https://github.com/mxrch/GHunt.git@5ee893929c51c7a8a665b199bbae04ce85a662b4" && \
    ln -s ~/.local/bin/ghunt /usr/local/bin/ghunt

COPY . .

RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "--worker-class", "gthread", "--threads", "100", "-w", "1", "--bind", "0.0.0.0:5000", "wsgi:app"]
