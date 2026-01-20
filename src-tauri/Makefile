TAURI_DB_PATH ?= $(shell pwd)/test_journal.db
DATABASE_URL = sqlite:$(TAURI_DB_PATH)?mode=rwc
SQLX_CMD := $(shell if command -v cargo-sqlx >/dev/null 2>&1; then echo "cargo sqlx"; elif command -v sqlx >/dev/null 2>&1; then echo "sqlx"; else echo ""; fi)

.PHONY: help migrate-add migrate-run migrate-revert migrate-info migrate-status install-sqlx

help: 
	@echo "Migration Management Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "Environment variables:"
	@echo "  TAURI_DB_PATH     Override database path (default: ./test_journal.db)"
	@echo ""
	@echo "Examples:"
	@echo "  make migrate-add MIGRATION_NAME=add_user_table"
	@echo "  make migrate-run"
	@echo "  TAURI_DB_PATH=/path/to/db.db make migrate-status"

install-sqlx: 
	@echo "Installing sqlx-cli..."
	@cargo install sqlx-cli --features sqlite
	@echo "sqlx-cli installed successfully!"

migrate-add: 
	@if [ -z "$(MIGRATION_NAME)" ]; then \
		echo "Error: MIGRATION_NAME is required"; \
		echo "Usage: make migrate-add MIGRATION_NAME=add_user_table"; \
		exit 1; \
	fi
	@if [ -z "$(SQLX_CMD)" ]; then \
		echo "Error: sqlx-cli is not installed."; \
		echo "Install it with: make install-sqlx"; \
		echo "Or: cargo install sqlx-cli --features sqlite"; \
		exit 1; \
	fi
	@echo "Creating migration: $(MIGRATION_NAME)"
	@echo "Database: $(TAURI_DB_PATH)"
	@DATABASE_URL="$(DATABASE_URL)" $(SQLX_CMD) migrate add $(MIGRATION_NAME)

migrate-run: 
	@if [ -z "$(SQLX_CMD)" ]; then \
		echo "Error: sqlx-cli is not installed."; \
		echo "Install it with: make install-sqlx"; \
		echo "Or: cargo install sqlx-cli --features sqlite"; \
		exit 1; \
	fi
	@echo "Running migrations..."
	@echo "Database: $(TAURI_DB_PATH)"
	@if [ ! -f "$(TAURI_DB_PATH)" ]; then \
		echo "Creating database directory..."; \
		mkdir -p $$(dirname "$(TAURI_DB_PATH)"); \
	fi
	@DATABASE_URL="$(DATABASE_URL)" $(SQLX_CMD) migrate run

migrate-revert: 
	@if [ -z "$(SQLX_CMD)" ]; then \
		echo "Error: sqlx-cli is not installed."; \
		echo "Install it with: make install-sqlx"; \
		echo "Or: cargo install sqlx-cli --features sqlite"; \
		exit 1; \
	fi
	@echo "Reverting last migration..."
	@echo "Database: $(TAURI_DB_PATH)"
	@DATABASE_URL="$(DATABASE_URL)" $(SQLX_CMD) migrate revert

migrate-info: 
	@if [ -z "$(SQLX_CMD)" ]; then \
		echo "Error: sqlx-cli is not installed."; \
		echo "Install it with: make install-sqlx"; \
		echo "Or: cargo install sqlx-cli --features sqlite"; \
		exit 1; \
	fi
	@echo "Migration info for: $(TAURI_DB_PATH)"
	@DATABASE_URL="$(DATABASE_URL)" $(SQLX_CMD) migrate info

migrate-status: 
	@if [ -z "$(SQLX_CMD)" ]; then \
		echo "Error: sqlx-cli is not installed."; \
		echo "Install it with: make install-sqlx"; \
		echo "Or: cargo install sqlx-cli --features sqlite"; \
		exit 1; \
	fi
	@echo "Checking migration status..."
	@echo "Database: $(TAURI_DB_PATH)"
	@if [ ! -f "$(TAURI_DB_PATH)" ]; then \
		echo "Database does not exist yet."; \
	else \
		DATABASE_URL=$(DATABASE_URL) $(SQLX_CMD) migrate info; \
	fi
