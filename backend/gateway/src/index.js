import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';

dotenv.config();

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';
const vehicleServiceUrl = process.env.VEHICLE_SERVICE_URL || 'http://localhost:4002';

const typeDefs = `#graphql
  type User {
    id: ID!
    username: String!
    email: String!
    role: String!
    created_at: String
  }

  type Vehicle {
    id: ID!
    plate_number: String!
    model: String!
    brand: String!
    vehicle_year: Int
    status: String!
    created_at: String
  }

  type VehiclePosition {
    id: ID!
    vehicle_id: ID!
    latitude: Float!
    longitude: Float!
    speed: Float
    recorded_at: String
  }

  type AuthPayload {
    user: User!
    token: String!
  }

  type Query {
    users: [User!]!
    vehicles: [Vehicle!]!
    vehicle(id: ID!): Vehicle
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
    role: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input VehicleInput {
    plate_number: String!
    model: String!
    brand: String!
    vehicle_year: Int
    status: String
  }

  input VehiclePositionInput {
    latitude: Float!
    longitude: Float!
    speed: Float
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    createVehicle(input: VehicleInput!): Vehicle!
    addVehiclePosition(vehicleId: ID!, input: VehiclePositionInput!): VehiclePosition!
  }
`;

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Erreur de service');
  }

  return data;
}

const resolvers = {
  Query: {
    users: async (_parent, _args, context) => {
      return requestJson(`${authServiceUrl}/auth/users`, {
        headers: { Authorization: context.authorization || '' },
      });
    },
    vehicles: async (_parent, _args, context) => {
      return requestJson(`${vehicleServiceUrl}/vehicles`, {
        headers: { Authorization: context.authorization || '' },
      });
    },
    vehicle: async (_parent, { id }, context) => {
      return requestJson(`${vehicleServiceUrl}/vehicles/${id}`, {
        headers: { Authorization: context.authorization || '' },
      }).catch(() => null);
    },
  },
  Mutation: {
    register: async (_parent, { input }) => {
      const data = await requestJson(`${authServiceUrl}/auth/register`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data;
    },
    login: async (_parent, { input }) => {
      const data = await requestJson(`${authServiceUrl}/auth/login`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data;
    },
    createVehicle: async (_parent, { input }, context) => {
      return requestJson(`${vehicleServiceUrl}/vehicles`, {
        method: 'POST',
        headers: { Authorization: context.authorization || '' },
        body: JSON.stringify(input),
      });
    },
    addVehiclePosition: async (_parent, { vehicleId, input }, context) => {
      return requestJson(`${vehicleServiceUrl}/vehicles/${vehicleId}/positions`, {
        method: 'POST',
        headers: { Authorization: context.authorization || '' },
        body: JSON.stringify(input),
      });
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const app = express();
app.use(cors());
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

await server.start();

app.use(
  '/graphql',
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => ({
      authorization: req.headers.authorization || '',
    }),
  })
);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Gateway running on ${port}`);
});

