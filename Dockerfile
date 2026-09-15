FROM postgres:17-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY infra/backup/backup.sh /app/backup.sh
COPY infra/backup/restore-verify.sh /app/restore-verify.sh
RUN chmod 0755 /app/backup.sh /app/restore-verify.sh

ENTRYPOINT ["/app/backup.sh"]
