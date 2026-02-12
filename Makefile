COMPOSE := docker compose

.PHONY: build stop clean cleandb startdb

build:
	$(COMPOSE) up --build -d

stop:
	$(COMPOSE) stop

clean:
	$(COMPOSE) down --remove-orphans

# Removes named volumes (wipes MongoDB data).
cleandb:
	$(COMPOSE) down --volumes --remove-orphans

startdb: 
	$(COMPOSE) up -d mongodb
