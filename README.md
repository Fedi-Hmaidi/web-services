# Plateforme Intelligente de Gestion du Trafic Urbain

Stack livrée:

- Frontend React + Apollo Client + React Router + Material UI
- Gateway GraphQL Apollo Server
- Auth Service Express + PostgreSQL + JWT + Bcrypt
- Vehicle Service Express + PostgreSQL + JWT
- PostgreSQL via Docker

## Démarrage

1. Copier `.env.example` en `.env` si vous voulez exécuter hors Docker.
2. Lancer la stack:

```bash
docker compose up --build
```

3. Ouvrir:

- Frontend: `http://localhost:3000`
- Gateway GraphQL: `http://localhost:4000/graphql`
- Auth service: `http://localhost:4001/health`
- Vehicle service: `http://localhost:4002/health`

## Notes

- Le Gateway est l'unique point d'entrée prévu pour le frontend.
- Les services valident le JWT via `JWT_SECRET`.
- Le endpoint `GET /auth/users` est ajouté pour permettre la requête GraphQL `users`.

