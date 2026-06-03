import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { gql, useMutation, useQuery } from '@apollo/client';
import {
  AppBar,
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Toolbar,
  Typography,
  Grid,
  Card,
  CardContent,
} from '@mui/material';

const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        username
        email
        role
      }
    }
  }
`;

const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
        email
        role
      }
    }
  }
`;

const CREATE_VEHICLE = gql`
  mutation CreateVehicle($input: VehicleInput!) {
    createVehicle(input: $input) {
      id
      plate_number
      model
      brand
      vehicle_year
      status
    }
  }
`;

const VEHICLES_QUERY = gql`
  query Vehicles {
    vehicles {
      id
      plate_number
      model
      brand
      vehicle_year
      status
      created_at
    }
  }
`;

function Layout({ children }) {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  return (
    <Box className="shell">
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" component={Link} to="/" className="brand">
            Urban Traffic Intelligence
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button component={Link} to="/vehicles" variant="outlined">Vehicles</Button>
            {!token ? (
              <>
                <Button component={Link} to="/login" variant="outlined">Login</Button>
                <Button component={Link} to="/register" variant="contained">Register</Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  navigate('/login');
                }}
              >
                Logout
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 4 }}>{children}</Container>
    </Box>
  );
}

function AuthForm({ title, submitLabel, onSubmit, fields }) {
  const [form, setForm] = useState(
    fields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {})
  );

  return (
    <Paper className="panel">
      <Typography variant="h4" gutterBottom>{title}</Typography>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        sx={{ display: 'grid', gap: 2 }}
      >
        {fields.map((field) => (
          <TextField
            key={field.name}
            label={field.label}
            type={field.type || 'text'}
            value={form[field.name]}
            onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
            fullWidth
          />
        ))}
        <Button type="submit" variant="contained" size="large">
          {submitLabel}
        </Button>
      </Box>
    </Paper>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [login] = useMutation(LOGIN_MUTATION);

  return (
    <AuthForm
      title="Connexion"
      submitLabel="Entrer"
      fields={[
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'password', label: 'Mot de passe', type: 'password' },
      ]}
      onSubmit={async (form) => {
        const { data } = await login({ variables: { input: form } });
        localStorage.setItem('token', data.login.token);
        localStorage.setItem('user', JSON.stringify(data.login.user));
        navigate('/vehicles');
      }}
    />
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const [register] = useMutation(REGISTER_MUTATION);

  return (
    <AuthForm
      title="Inscription"
      submitLabel="Créer le compte"
      fields={[
        { name: 'username', label: 'Nom utilisateur' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'password', label: 'Mot de passe', type: 'password' },
        { name: 'role', label: 'Role (ADMIN ou OPERATOR)' },
      ]}
      onSubmit={async (form) => {
        const payload = {
          ...form,
          role: form.role || 'OPERATOR',
        };
        const { data } = await register({ variables: { input: payload } });
        localStorage.setItem('token', data.register.token);
        localStorage.setItem('user', JSON.stringify(data.register.user));
        navigate('/vehicles');
      }}
    />
  );
}

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  return (
    <Paper className="panel">
      <Typography variant="h3" gutterBottom>
        Plateforme Intelligente de Gestion du Trafic Urbain
      </Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        Frontend React + Apollo Client connecté au Gateway GraphQL.
      </Typography>
      {user ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Session active</Typography>
            <Typography>{user.username} - {user.role}</Typography>
            <Typography>{user.email}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Typography>Connectez-vous pour accéder aux véhicules et aux opérations métier.</Typography>
      )}
    </Paper>
  );
}

function VehiclesPage() {
  const [form, setForm] = useState({
    plate_number: '',
    model: '',
    brand: '',
    vehicle_year: '',
    status: 'ACTIVE',
  });
  const { data, loading, refetch } = useQuery(VEHICLES_QUERY, {
    fetchPolicy: 'network-only',
  });
  const [createVehicle] = useMutation(CREATE_VEHICLE);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Paper className="panel">
          <Typography variant="h5" gutterBottom>Créer un véhicule</Typography>
          <Box
            component="form"
            onSubmit={async (e) => {
              e.preventDefault();
              await createVehicle({
                variables: {
                  input: {
                    ...form,
                    vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
                  },
                },
              });
              await refetch();
            }}
            sx={{ display: 'grid', gap: 2 }}
          >
            <TextField label="Plaque" value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} />
            <TextField label="Modèle" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <TextField label="Marque" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <TextField label="Année" value={form.vehicle_year} onChange={(e) => setForm({ ...form, vehicle_year: e.target.value })} />
            <TextField label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
            <Button type="submit" variant="contained">Ajouter</Button>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={8}>
        <Paper className="panel">
          <Typography variant="h5" gutterBottom>Liste des véhicules</Typography>
          {loading ? (
            <Typography>Chargement...</Typography>
          ) : (
            <Grid container spacing={2}>
              {(data?.vehicles || []).map((vehicle) => (
                <Grid item xs={12} sm={6} key={vehicle.id}>
                  <Card variant="outlined" className="vehicle-card">
                    <CardContent>
                      <Typography variant="h6">{vehicle.plate_number}</Typography>
                      <Typography>{vehicle.brand} - {vehicle.model}</Typography>
                      <Typography>Année: {vehicle.vehicle_year || '-'}</Typography>
                      <Typography>Statut: {vehicle.status}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/vehicles"
          element={
            <RequireAuth>
              <VehiclesPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

