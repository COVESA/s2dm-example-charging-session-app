COMPOSE := COMPOSE_PROFILES=local docker compose
COMPOSE_ATLAS := docker compose
ATLAS_SERVICES := frontend backend simulator
LOCAL_DOCKER_MONGODB_URI := mongodb://mongodb:27017/?replicaSet=rs0&directConnection=true

.PHONY: build start stop clean cleandb startdb build-atlas start-atlas stop-atlas clean-atlas

build:
	MONGODB_URI=$(LOCAL_DOCKER_MONGODB_URI) $(COMPOSE) up --build -d

start:
	MONGODB_URI=$(LOCAL_DOCKER_MONGODB_URI) $(COMPOSE) up -d

stop:
	$(COMPOSE) stop

clean:
	$(COMPOSE) down --remove-orphans

# Removes named volumes (wipes MongoDB data).
cleandb:
	$(COMPOSE) down --volumes --remove-orphans

startdb: 
	$(COMPOSE) up -d mongodb

build-atlas:
	$(COMPOSE_ATLAS) up --build -d $(ATLAS_SERVICES)

start-atlas:
	$(COMPOSE_ATLAS) up -d $(ATLAS_SERVICES)

stop-atlas:
	$(COMPOSE_ATLAS) stop $(ATLAS_SERVICES)

clean-atlas:
	$(COMPOSE_ATLAS) rm -f -s $(ATLAS_SERVICES)
