import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';

dotenv.config();

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';
const vehicleServiceUrl = process.env.VEHICLE_SERVICE_URL || 'http://localhost:4002';
const trafficServiceUrl = process.env.TRAFFIC_SERVICE_URL || 'http://localhost:4003';
const incidentServiceUrl = process.env.INCIDENT_SERVICE_URL || 'http://localhost:4004';
const loggingServiceUrl = process.env.LOGGING_SERVICE_URL || 'http://localhost:4005';
const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4006';

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

  type TrafficZone {
    id: ID!
    name: String!
    latitude_min: Float!
    latitude_max: Float!
    longitude_min: Float!
    longitude_max: Float!
    density: Int!
    classification: String!
    is_congested: Boolean!
    created_at: String
  }

  type Incident {
    id: ID!
    title: String!
    description: String
    type: String!
    status: String!
    latitude: Float
    longitude: Float
    created_at: String
    updated_at: String
  }

  type Log {
    id: ID!
    log_type: String!
    level: String!
    message: String!
    module: String!
    user_id: ID
    username: String
    action: String
    resource: String
    context: String
    created_at: String
  }

  type Notification {
    id: ID!
    user_id: ID!
    title: String!
    message: String!
    type: String!
    is_read: Boolean!
    created_at: String!
  }

  type LogResult {
    logs: [Log!]!
    total: Int!
    pages: Int!
  }

  type AuthPayload {
    user: User!
    token: String!
  }

  type Query {
    users: [User!]!
    vehicles: [Vehicle!]!
    vehicle(id: ID!): Vehicle
    trafficZones: [TrafficZone!]!
    incidents: [Incident!]!
    notifications(unread: Boolean): [Notification!]!
    logs(
      log_type: String
      level: String
      module: String
      username: String
      action: String
      search: String
      page: Int
      limit: Int
    ): LogResult!
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

  input TrafficZoneInput {
    name: String!
    latitude_min: Float!
    latitude_max: Float!
    longitude_min: Float!
    longitude_max: Float!
  }

  input DeclareIncidentInput {
    title: String!
    description: String
    type: String!
    latitude: Float
    longitude: Float
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    createVehicle(input: VehicleInput!): Vehicle!
    addVehiclePosition(vehicleId: ID!, input: VehiclePositionInput!): VehiclePosition!
    createTrafficZone(input: TrafficZoneInput!): TrafficZone!
    declareIncident(input: DeclareIncidentInput!): Incident!
    updateIncidentStatus(id: ID!, status: String!): Incident!
    markNotificationAsRead(id: ID!): Notification!
    markAllNotificationsAsRead: Boolean!
    broadcastAnnouncement(title: String!, message: String!): Boolean!
  }
`;

async function requestJson(url, options = {}) {
  const { headers, ...restOptions } = options;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    ...restOptions,
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
    trafficZones: async (_parent, _args, context) => {
      return requestJson(`${trafficServiceUrl}/traffic/zones`, {
        headers: { Authorization: context.authorization || '' },
      });
    },
    incidents: async (_parent, _args, context) => {
      return requestJson(`${incidentServiceUrl}/incidents`, {
        headers: { Authorization: context.authorization || '' },
      });
    },
    notifications: async (_parent, { unread }, context) => {
      const url = `${notificationServiceUrl}/notifications${unread ? '?unread=true' : ''}`;
      return requestJson(url, {
        headers: { Authorization: context.authorization || '' },
      });
    },
    logs: async (_parent, args, context) => {
      const params = new URLSearchParams();
      if (args.log_type) params.append('log_type', args.log_type);
      if (args.level) params.append('level', args.level);
      if (args.module) params.append('module', args.module);
      if (args.username) params.append('username', args.username);
      if (args.action) params.append('action', args.action);
      if (args.search) params.append('search', args.search);
      if (args.page) params.append('page', args.page);
      if (args.limit) params.append('limit', args.limit);

      const queryString = params.toString();
      const url = `${loggingServiceUrl}/logs${queryString ? '?' + queryString : ''}`;

      return requestJson(url, {
        headers: { Authorization: context.authorization || '' },
      });
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
    createTrafficZone: async (_parent, { input }, context) => {
      return requestJson(`${trafficServiceUrl}/traffic/zones`, {
        method: 'POST',
        headers: { Authorization: context.authorization || '' },
        body: JSON.stringify(input),
      });
    },
    declareIncident: async (_parent, { input }, context) => {
      return requestJson(`${incidentServiceUrl}/incidents`, {
        method: 'POST',
        headers: { Authorization: context.authorization || '' },
        body: JSON.stringify(input),
      });
    },
    updateIncidentStatus: async (_parent, { id, status }, context) => {
      return requestJson(`${incidentServiceUrl}/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: context.authorization || '' },
        body: JSON.stringify({ status }),
      });
    },
    markNotificationAsRead: async (_parent, { id }, context) => {
      return requestJson(`${notificationServiceUrl}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: context.authorization || '' },
      });
    },
    markAllNotificationsAsRead: async (_parent, _args, context) => {
      await requestJson(`${notificationServiceUrl}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: context.authorization || '' },
      });
      return true;
    },
    broadcastAnnouncement: async (_parent, { title, message }, context) => {
      await requestJson(`${notificationServiceUrl}/notifications/announcement`, {
        method: 'POST',
        headers: { Authorization: context.authorization || '' },
        body: JSON.stringify({ title, message }),
      });
      return true;
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

