# ─── APM Self Service — Makefile ─────────────────────────────────────────────
# Usage: make <target>
#
# Requires:
#   - Node.js / npm
#   - MariaDB running dan accessible
#   - .env file (copy dari .env.example lalu isi nilainya)

.PHONY: help install dev build start \
        db-migrate db-migrate-raw db-generate db-studio db-seed db-status \
        setup check-env clean clean-all

# Baca .env via shell (aman untuk karakter khusus seperti #, @, $)
# Menggunakan grep + sed agar # tidak dianggap komentar oleh make
define get_env
$(shell grep -E '^$(1)=' .env 2>/dev/null | head -1 | sed "s/^$(1)=//" | sed "s/^'//" | sed "s/'$$//" | sed 's/^"//' | sed 's/"$$//')
endef

DB_USER := $(call get_env,DB_USER)
DB_PASS := $(call get_env,DB_PASS)
DB_HOST := $(call get_env,DB_HOST)
DB_PORT := $(call get_env,DB_PORT)
DB_NAME := $(call get_env,DB_NAME)

# Export DATABASE_URL untuk npm scripts (Drizzle pakai ini)
export DATABASE_URL := $(call get_env,DATABASE_URL)
export JWT_SECRET   := $(call get_env,JWT_SECRET)
export APP_URL      := $(call get_env,APP_URL)
export KIOSK_TIMEOUT_MS := $(call get_env,KIOSK_TIMEOUT_MS)

# Koneksi MySQL — password dipass via env var MYSQL_PWD agar # tidak diparse shell
MYSQL_CMD = MYSQL_PWD='$(DB_PASS)' mysql -u'$(DB_USER)' -h'$(DB_HOST)' -P'$(DB_PORT)' --ssl=false

# ─── Help ─────────────────────────────────────────────────────────────────────

help: ## Tampilkan daftar perintah
	@echo ""
	@echo "  APM Self Service — Available Commands"
	@echo "  ────────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' Makefile \
		| sed 's/:.*## /|/' \
		| awk -F'|' '{printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Setup ───────────────────────────────────────────────────────────────────

install: ## Install semua npm dependencies
	npm install --legacy-peer-deps

setup: check-env install db-migrate-raw ## Setup lengkap: install deps + buat DB + jalankan migration
	@echo ""
	@echo "  ✅  Setup selesai!"
	@echo "  Jalankan \033[36mmake dev\033[0m untuk mulai development server."
	@echo ""

check-env: ## Cek apakah file .env ada dan variabel DB terdefinisi
	@if [ ! -f .env ]; then \
		echo ""; \
		echo "  ❌  File .env tidak ditemukan!"; \
		echo "  Jalankan: cp .env.example .env"; \
		echo "  Lalu isi DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME, JWT_SECRET."; \
		echo ""; \
		exit 1; \
	fi
	@if [ -z '$(DB_USER)' ] || [ -z '$(DB_NAME)' ]; then \
		echo ""; \
		echo "  ❌  Variabel DB_USER atau DB_NAME kosong di .env!"; \
		echo "  Pastikan .env berisi: DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME"; \
		echo ""; \
		exit 1; \
	fi
	@echo "  ✔  .env OK  (host: $(DB_HOST):$(DB_PORT), db: $(DB_NAME))"

# ─── Development ─────────────────────────────────────────────────────────────

dev: check-env ## Jalankan development server (vinxi dev)
	npm run dev

# ─── Build & Start ───────────────────────────────────────────────────────────

build: check-env ## Build untuk production
	@echo "  🔨  Building production bundle..."
	npm run build
	@echo "  ✅  Build selesai di .output/"

start: check-env ## Jalankan production server (setelah build)
	npm run start

# ─── Database ────────────────────────────────────────────────────────────────

db-migrate-raw: check-env ## Buat database + jalankan 0000_init.sql langsung ke MariaDB
	@echo "  📦  Membuat database '$(DB_NAME)' jika belum ada..."
	@$(MYSQL_CMD) -e "CREATE DATABASE IF NOT EXISTS \`$(DB_NAME)\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
	@echo "  🗄️   Menjalankan semua migration SQL ..."
	@for migration in drizzle/migrations/*.sql; do \
		echo "     $$migration"; \
		$(MYSQL_CMD) '$(DB_NAME)' < "$$migration" || exit 1; \
	done
	@echo "  ✅  Migration selesai."

db-generate: ## Generate Drizzle migration baru dari perubahan schema
	@echo "  🔧  Generating Drizzle migration..."
	npm run db:generate
	@echo "  ✅  Migration files dibuat di drizzle/migrations/"

db-migrate: check-env ## Jalankan Drizzle migration via drizzle-kit
	@echo "  🗄️   Menjalankan Drizzle migration..."
	npm run db:migrate
	@echo "  ✅  Migration selesai."

db-studio: check-env ## Buka Drizzle Studio (GUI database browser)
	npm run db:studio

db-seed: check-env ## Re-seed data default (services + admin accounts)
	@echo "  🌱  Seeding data default..."
	@$(MYSQL_CMD) '$(DB_NAME)' -e "\
		INSERT INTO services (code, label, icon, is_active) VALUES \
		  ('registrasi',   'Pasien BPJS',       'ClipboardList', TRUE), \
		  ('poli_umum',    'Pasien Umum',       'Stethoscope',   TRUE), \
		  ('igd',          'IGD',               'Ambulance',     TRUE), \
		  ('laboratorium', 'Laboratorium',      'FlaskConical',  TRUE) \
		ON DUPLICATE KEY UPDATE label = VALUES(label), is_active = VALUES(is_active);"
	@echo "  ✅  Seed selesai (4 layanan)."

db-status: check-env ## Cek jumlah data di setiap tabel
	@echo ""
	@echo "  📊  Database: $(DB_NAME) @ $(DB_HOST):$(DB_PORT)"
	@echo "  ─────────────────────────────────────────────────"
	@$(MYSQL_CMD) '$(DB_NAME)' -e "\
		SELECT 'services' AS tabel, COUNT(*) AS jumlah FROM services \
		UNION ALL \
		SELECT 'admins',  COUNT(*) FROM admins \
		UNION ALL \
		SELECT 'visits (total)',  COUNT(*) FROM visits \
		UNION ALL \
		SELECT 'visits (waiting)',  COUNT(*) FROM visits WHERE status = 'waiting' \
		UNION ALL \
		SELECT 'visits (served)',   COUNT(*) FROM visits WHERE status = 'served';"
	@echo ""

# ─── Cleanup ─────────────────────────────────────────────────────────────────

clean: ## Hapus build artifacts (.output, .vinxi)
	@echo "  🧹  Membersihkan build artifacts..."
	rm -rf .output .vinxi
	@echo "  ✅  Bersih."

clean-all: clean ## Hapus build artifacts + node_modules (perlu make install lagi)
	@echo "  🧹  Menghapus node_modules..."
	rm -rf node_modules package-lock.json
	@echo "  ✅  Bersih total. Jalankan 'make install' untuk install ulang."
