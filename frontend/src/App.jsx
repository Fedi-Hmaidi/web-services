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
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CardActions,
  LinearProgress,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  DirectionsCar as CarIcon,
  ReportProblem as IncidentIcon,
  Traffic as TrafficIcon,
  Build as BuildIcon,
  Block as BlockIcon,
  HelpOutline as UnknownIcon,
} from '@mui/icons-material';

// --- GraphQL Operations ---

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

const TRAFFIC_ZONES_QUERY = gql`
  query TrafficZones {
    trafficZones {
      id
      name
      latitude_min
      latitude_max
      longitude_min
      longitude_max
      density
      classification
      is_congested
      created_at
    }
  }
`;

const CREATE_TRAFFIC_ZONE = gql`
  mutation CreateTrafficZone($input: TrafficZoneInput!) {
    createTrafficZone(input: $input) {
      id
      name
      latitude_min
      latitude_max
      longitude_min
      longitude_max
      density
      classification
      is_congested
    }
  }
`;

const INCIDENTS_QUERY = gql`
  query Incidents {
    incidents {
      id
      title
      description
      type
      status
      latitude
      longitude
      created_at
      updated_at
    }
  }
`;

const DECLARE_INCIDENT = gql`
  mutation DeclareIncident($input: DeclareIncidentInput!) {
    declareIncident(input: $input) {
      id
      title
      type
      status
      latitude
      longitude
    }
  }
`;

const UPDATE_INCIDENT_STATUS = gql`
  mutation UpdateIncidentStatus($id: ID!, $status: String!) {
    updateIncidentStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

const DASHBOARD_QUERY = gql`
  query DashboardData {
    vehicles {
      id
      status
    }
    trafficZones {
      id
      is_congested
    }
    incidents {
      id
      status
    }
  }
`;

// --- Components ---

function Layout({ children }) {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  return (
    <Box className="shell">
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
          <Typography variant="h6" component={Link} to="/" className="brand" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrafficIcon color="primary" /> Urban Traffic Intelligence
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button component={Link} to="/" sx={{ fontWeight: 600 }}>Accueil</Button>
            {token && (
              <>
                <Button component={Link} to="/vehicles" sx={{ fontWeight: 600 }}>Véhicules</Button>
                <Button component={Link} to="/traffic-zones" sx={{ fontWeight: 600 }}>Zones Trafic</Button>
                <Button component={Link} to="/incidents" sx={{ fontWeight: 600 }}>Incidents</Button>
              </>
            )}
            {!token ? (
              <>
                <Button component={Link} to="/login" variant="outlined">Login</Button>
                <Button component={Link} to="/register" variant="contained">Register</Button>
              </>
            ) : (
              <Button
                variant="contained"
                color="error"
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
    <Paper className="panel" sx={{ maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }} align="center">{title}</Typography>
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
            required
          />
        ))}
        <Button type="submit" variant="contained" size="large" sx={{ mt: 2 }}>
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
      submitLabel="Se connecter"
      fields={[
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'password', label: 'Mot de passe', type: 'password' },
      ]}
      onSubmit={async (form) => {
        try {
          const { data } = await login({ variables: { input: form } });
          localStorage.setItem('token', data.login.token);
          localStorage.setItem('user', JSON.stringify(data.login.user));
          navigate('/');
        } catch (err) {
          alert(err.message || 'Identifiants invalides');
        }
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
        try {
          const payload = {
            ...form,
            role: form.role || 'OPERATOR',
          };
          const { data } = await register({ variables: { input: payload } });
          localStorage.setItem('token', data.register.token);
          localStorage.setItem('user', JSON.stringify(data.register.user));
          navigate('/');
        } catch (err) {
          alert(err.message || 'Erreur d\'inscription');
        }
      }}
    />
  );
}

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');
  const { data, loading } = useQuery(DASHBOARD_QUERY, {
    skip: !token,
    fetchPolicy: 'network-only',
  });

  const activeVehicles = data?.vehicles?.length || 0;
  const congestedZones = data?.trafficZones?.filter(z => z.is_congested)?.length || 0;
  const activeIncidents = data?.incidents?.filter(i => i.status !== 'Résolu')?.length || 0;

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <Paper className="panel" sx={{ p: 4, background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 246, 255, 0.8) 100%)' }}>
        <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, background: 'linear-gradient(45deg, #0d9488, #2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Gestion Intelligente de la Circulation
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mb: 3 }}>
          Système connecté d'analyse du trafic urbain, de suivi de flotte et de gestion des incidents.
        </Typography>
        
        {user ? (
          <Card variant="outlined" className="glass-card" sx={{ maxWidth: 400 }}>
            <CardContent>
              <Typography variant="subtitle2" color="primary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>Session active</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{user.username}</Typography>
              <Typography variant="body2" color="text.secondary">Rôle: <Chip label={user.role} size="small" color={user.role === 'ADMIN' ? 'error' : 'secondary'} /></Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{user.email}</Typography>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Veuillez vous connecter pour accéder aux outils de gestion du trafic et des incidents.
            </Typography>
            <Button component={Link} to="/login" variant="contained" size="large">Se connecter</Button>
          </Box>
        )}
      </Paper>

      {token && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Card className="metric-card panel" sx={{ borderLeft: '6px solid #2563eb' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>Véhicules Enregistrés</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, mt: 1 }}>{loading ? '...' : activeVehicles}</Typography>
                </Box>
                <CarIcon color="primary" sx={{ fontSize: 50, opacity: 0.8 }} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card className={`metric-card panel ${congestedZones > 0 ? 'pulse-border' : ''}`} sx={{ borderLeft: '6px solid #d97706' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>Zones Congestionnées</Typography>
                  <Typography variant="h3" color={congestedZones > 0 ? 'error' : 'text.primary'} sx={{ fontWeight: 800, mt: 1 }}>{loading ? '...' : congestedZones}</Typography>
                </Box>
                <TrafficIcon color={congestedZones > 0 ? 'error' : 'warning'} sx={{ fontSize: 50, opacity: 0.8 }} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card className="metric-card panel" sx={{ borderLeft: '6px solid #dc2626' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>Incidents Actifs</Typography>
                  <Typography variant="h3" color={activeIncidents > 0 ? 'error' : 'text.primary'} sx={{ fontWeight: 800, mt: 1 }}>{loading ? '...' : activeIncidents}</Typography>
                </Box>
                <IncidentIcon color="error" sx={{ fontSize: 50, opacity: 0.8 }} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
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
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Créer un véhicule</Typography>
          <Box
            component="form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await createVehicle({
                  variables: {
                    input: {
                      ...form,
                      vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
                    },
                  },
                });
                setForm({ plate_number: '', model: '', brand: '', vehicle_year: '', status: 'ACTIVE' });
                await refetch();
              } catch (err) {
                alert(err.message || 'Erreur lors de la création du véhicule');
              }
            }}
            sx={{ display: 'grid', gap: 2 }}
          >
            <TextField label="Plaque d'immatriculation" value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} required />
            <TextField label="Modèle" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            <TextField label="Marque" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
            <TextField label="Année de fabrication" type="number" value={form.vehicle_year} onChange={(e) => setForm({ ...form, vehicle_year: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Statut</InputLabel>
              <Select
                value={form.status}
                label="Statut"
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <MenuItem value="ACTIVE">Actif</MenuItem>
                <MenuItem value="MAINTENANCE">En Maintenance</MenuItem>
                <MenuItem value="INACTIVE">Inactif</MenuItem>
              </Select>
            </FormControl>
            <Button type="submit" variant="contained" size="large">Ajouter</Button>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={8}>
        <Paper className="panel">
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Liste des véhicules</Typography>
          {loading ? (
            <LinearProgress />
          ) : (
            <Grid container spacing={2}>
              {(data?.vehicles || []).map((vehicle) => (
                <Grid item xs={12} sm={6} key={vehicle.id}>
                  <Card variant="outlined" className="glass-card" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{vehicle.plate_number}</Typography>
                      <Typography variant="body1">{vehicle.brand} {vehicle.model}</Typography>
                      <Typography variant="body2" color="text.secondary">Année: {vehicle.vehicle_year || '-'}</Typography>
                      <Box sx={{ mt: 2 }}>
                        <Chip
                          label={vehicle.status}
                          color={vehicle.status === 'ACTIVE' ? 'success' : vehicle.status === 'MAINTENANCE' ? 'warning' : 'default'}
                          size="small"
                        />
                      </Box>
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

function TrafficZonesPage() {
  const [form, setForm] = useState({
    name: '',
    latitude_min: '',
    latitude_max: '',
    longitude_min: '',
    longitude_max: '',
  });

  const { data, loading, refetch } = useQuery(TRAFFIC_ZONES_QUERY, {
    fetchPolicy: 'network-only',
  });

  const [createTrafficZone] = useMutation(CREATE_TRAFFIC_ZONE);

  const populatePreset = (preset) => {
    if (preset === 'paris_centre') {
      setForm({
        name: 'Paris Centre Ville',
        latitude_min: '48.8500',
        latitude_max: '48.8650',
        longitude_min: '2.3300',
        longitude_max: '2.3600',
      });
    } else if (preset === 'paris_nord') {
      setForm({
        name: 'Paris Zone Nord',
        latitude_min: '48.8700',
        latitude_max: '48.8900',
        longitude_min: '2.3200',
        longitude_max: '2.3500',
      });
    } else if (preset === 'paris_ouest') {
      setForm({
        name: 'Périphérique Ouest',
        latitude_min: '48.8300',
        latitude_max: '48.8500',
        longitude_min: '2.2400',
        longitude_max: '2.2800',
      });
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Paper className="panel">
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Créer une zone</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Définissez une boîte de délimitation géographique.
          </Typography>
          
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" onClick={() => populatePreset('paris_centre')}>Preset Centre</Button>
            <Button size="small" variant="outlined" onClick={() => populatePreset('paris_nord')}>Preset Nord</Button>
            <Button size="small" variant="outlined" onClick={() => populatePreset('paris_ouest')}>Preset Ouest</Button>
          </Box>

          <Box
            component="form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await createTrafficZone({
                  variables: {
                    input: {
                      name: form.name,
                      latitude_min: Number(form.latitude_min),
                      latitude_max: Number(form.latitude_max),
                      longitude_min: Number(form.longitude_min),
                      longitude_max: Number(form.longitude_max),
                    },
                  },
                });
                setForm({ name: '', latitude_min: '', latitude_max: '', longitude_min: '', longitude_max: '' });
                await refetch();
              } catch (err) {
                alert(err.message || 'Erreur lors de la création de la zone');
              }
            }}
            sx={{ display: 'grid', gap: 2 }}
          >
            <TextField label="Nom de la zone" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField label="Latitude Min" type="number" step="0.0001" value={form.latitude_min} onChange={(e) => setForm({ ...form, latitude_min: e.target.value })} required />
            <TextField label="Latitude Max" type="number" step="0.0001" value={form.latitude_max} onChange={(e) => setForm({ ...form, latitude_max: e.target.value })} required />
            <TextField label="Longitude Min" type="number" step="0.0001" value={form.longitude_min} onChange={(e) => setForm({ ...form, longitude_min: e.target.value })} required />
            <TextField label="Longitude Max" type="number" step="0.0001" value={form.longitude_max} onChange={(e) => setForm({ ...form, longitude_max: e.target.value })} required />
            <Button type="submit" variant="contained" size="large">Créer la zone</Button>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={8}>
        <Paper className="panel">
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Zones de circulation & Densité</Typography>
          {loading ? (
            <LinearProgress />
          ) : (
            <Grid container spacing={2}>
              {(data?.trafficZones || []).map((zone) => (
                <Grid item xs={12} sm={6} key={zone.id}>
                  <Card 
                    variant="outlined" 
                    className={`glass-card ${zone.is_congested ? 'congested-zone-card' : ''}`}
                    sx={{ height: '100%', position: 'relative', overflow: 'visible' }}
                  >
                    {zone.is_congested && (
                      <Box className="congested-pulse-glow" />
                    )}
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{zone.name}</Typography>
                      
                      <Box sx={{ mt: 1, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Lat: [{zone.latitude_min} - {zone.latitude_max}]
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Lng: [{zone.longitude_min} - {zone.longitude_max}]
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Véhicules détectés : {zone.density}</Typography>
                        </Box>
                        <Chip
                          label={zone.classification}
                          color={zone.classification === 'Élevé' ? 'error' : zone.classification === 'Moyen' ? 'warning' : 'success'}
                          size="small"
                        />
                      </Box>

                      {zone.is_congested && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main', mt: 2, fontWeight: 700, fontSize: '0.8rem' }}>
                          <WarningIcon fontSize="small" className="blink" /> CONGESTION DÉTECTÉE
                        </Box>
                      )}
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

function IncidentsPage() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'Accident',
    latitude: '',
    longitude: '',
  });

  const { data, loading, refetch } = useQuery(INCIDENTS_QUERY, {
    fetchPolicy: 'network-only',
  });

  const [declareIncident] = useMutation(DECLARE_INCIDENT);
  const [updateIncidentStatus] = useMutation(UPDATE_INCIDENT_STATUS);

  const getIncidentIcon = (type) => {
    switch (type) {
      case 'Accident':
        return <WarningIcon color="error" />;
      case 'Travaux':
        return <BuildIcon color="warning" />;
      case 'Route fermée':
        return <BlockIcon color="action" />;
      case 'Embouteillage':
        return <TrafficIcon color="secondary" />;
      default:
        return <UnknownIcon />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Signalé':
        return 'info';
      case 'En cours':
        return 'warning';
      case 'Résolu':
        return 'success';
      default:
        return 'default';
    }
  };

  const populateCoordinates = () => {
    // Populate some coordinate close to seeded positions
    setForm({
      ...form,
      latitude: '48.8566',
      longitude: '2.3522',
    });
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Paper className="panel">
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Déclarer un incident</Typography>
          <Box
            component="form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await declareIncident({
                  variables: {
                    input: {
                      title: form.title,
                      description: form.description,
                      type: form.type,
                      latitude: form.latitude ? Number(form.latitude) : null,
                      longitude: form.longitude ? Number(form.longitude) : null,
                    },
                  },
                });
                setForm({ title: '', description: '', type: 'Accident', latitude: '', longitude: '' });
                await refetch();
              } catch (err) {
                alert(err.message || 'Erreur lors de la déclaration');
              }
            }}
            sx={{ display: 'grid', gap: 2 }}
          >
            <TextField label="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <TextField label="Description" multiline rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            
            <FormControl fullWidth>
              <InputLabel>Type d'incident</InputLabel>
              <Select
                value={form.type}
                label="Type d'incident"
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <MenuItem value="Accident">Accident</MenuItem>
                <MenuItem value="Travaux">Travaux</MenuItem>
                <MenuItem value="Route fermée">Route fermée</MenuItem>
                <MenuItem value="Embouteillage">Embouteillage</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="Latitude" type="number" step="0.0001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} fullWidth />
              <TextField label="Longitude" type="number" step="0.0001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} fullWidth />
            </Box>
            
            <Button size="small" variant="text" onClick={populateCoordinates}>Utiliser coordonnées test</Button>
            
            <Button type="submit" variant="contained" size="large">Déclarer</Button>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={8}>
        <Paper className="panel">
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Historique & Suivi des Incidents</Typography>
          {loading ? (
            <LinearProgress />
          ) : (
            <Grid container spacing={2}>
              {(data?.incidents || []).map((incident) => (
                <Grid item xs={12} sm={6} key={incident.id}>
                  <Card variant="outlined" className="glass-card" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getIncidentIcon(incident.type)}
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{incident.type}</Typography>
                        </Box>
                        <Chip
                          label={incident.status}
                          color={getStatusColor(incident.status)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{incident.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{incident.description || 'Aucune description fournie.'}</Typography>
                      
                      {incident.latitude && incident.longitude && (
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                          Localisation: {incident.latitude}, {incident.longitude}
                        </Typography>
                      )}
                    </CardContent>
                    <CardActions sx={{ borderTop: '1px solid rgba(0, 0, 0, 0.05)', p: 1.5, display: 'flex', gap: 1 }}>
                      {incident.status === 'Signalé' && (
                        <Button 
                          size="small" 
                          variant="contained" 
                          color="warning" 
                          onClick={async () => {
                            await updateIncidentStatus({ variables: { id: incident.id, status: 'En cours' } });
                            await refetch();
                          }}
                          fullWidth
                        >
                          Prendre en charge
                        </Button>
                      )}
                      {incident.status === 'En cours' && (
                        <Button 
                          size="small" 
                          variant="contained" 
                          color="success" 
                          onClick={async () => {
                            await updateIncidentStatus({ variables: { id: incident.id, status: 'Résolu' } });
                            await refetch();
                          }}
                          fullWidth
                        >
                          Marquer résolu
                        </Button>
                      )}
                      {incident.status === 'Résolu' && (
                        <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1, fontWeight: 600 }}>
                          <CheckCircleIcon fontSize="small" /> Résolu
                        </Typography>
                      )}
                    </CardActions>
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
        <Route
          path="/traffic-zones"
          element={
            <RequireAuth>
              <TrafficZonesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/incidents"
          element={
            <RequireAuth>
              <IncidentsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
