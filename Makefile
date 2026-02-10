COMPOSE := docker compose

.PHONY: build stop clean

build:
	$(COMPOSE) up --build -d

stop:
	$(COMPOSE) stop

clean:
	$(COMPOSE) down --volumes --remove-orphans
