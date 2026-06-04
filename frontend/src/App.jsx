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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tooltip,
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
  Visibility as EyeIcon,
  Close as CloseIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  VolumeUp as AnnouncementIcon,
  ErrorOutline as SystemIcon,
  MailOutline as GeneralIcon,
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

const NOTIFICATIONS_QUERY = gql`
  query GetNotifications($unread: Boolean) {
    notifications(unread: $unread) {
      id
      user_id
      title
      message
      type
      is_read
      created_at
    }
  }
`;

const MARK_READ_MUTATION = gql`
  mutation MarkRead($id: ID!) {
    markNotificationAsRead(id: $id) {
      id
      is_read
    }
  }
`;

const MARK_ALL_READ_MUTATION = gql`
  mutation MarkAllRead {
    markAllNotificationsAsRead
  }
`;

const BROADCAST_MUTATION = gql`
  mutation Broadcast($title: String!, $message: String!) {
    broadcastAnnouncement(title: $title, message: $message)
  }
`;

// --- Components ---

function getNotificationIcon(type) {
  switch (type) {
    case 'INCIDENT':
      return <IncidentIcon sx={{ color: '#ef4444' }} />;
    case 'TRAFFIC':
      return <TrafficIcon sx={{ color: '#f59e0b' }} />;
    case 'VEHICLE':
      return <CarIcon sx={{ color: '#3b82f6' }} />;
    case 'SYSTEM':
      return <WarningIcon sx={{ color: '#ec4899' }} />;
    case 'ANNOUNCEMENT':
      return <AnnouncementIcon sx={{ color: '#10b981' }} />;
    default:
      return <GeneralIcon sx={{ color: '#6b7280' }} />;
  }
}

function Layout({ children }) {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user && user.role === 'ADMIN';

  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  // Announcement dialog state
  const [announcementOpen, setAnnouncementOpen] = React.useState(false);
  const [annTitle, setAnnTitle] = React.useState('');
  const [annMsg, setAnnMsg] = React.useState('');

  const { data, refetch } = useQuery(NOTIFICATIONS_QUERY, {
    variables: { unread: false },
    skip: !token,
    fetchPolicy: 'network-only',
  });

  const [markRead] = useMutation(MARK_READ_MUTATION);
  const [markAllRead] = useMutation(MARK_ALL_READ_MUTATION);
  const [broadcast] = useMutation(BROADCAST_MUTATION);

  React.useEffect(() => {
    if (data && data.notifications) {
      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter(n => !n.is_read).length);
    }
  }, [data]);

  // WebSocket Connection for Real-Time notifications
  React.useEffect(() => {
    if (!token) return;

    const wsUrl = `ws://localhost:4006/?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'notification') {
          const newNotif = payload.data;
          
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Display Toast
          setToast(newNotif);
          setTimeout(() => setToast(null), 5000);
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WS Connection closed, retrying in 5 seconds...');
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await markRead({ variables: { id } });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!annTitle || !annMsg) return;
    try {
      await broadcast({ variables: { title: annTitle, message: annMsg } });
      setAnnouncementOpen(false);
      setAnnTitle('');
      setAnnMsg('');
      if (refetch) refetch();
    } catch (err) {
      alert(err.message || 'Erreur lors de la diffusion');
    }
  };

  const handleBellClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
  };

  const openPopover = Boolean(anchorEl);

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
                {isAdmin && (
                  <>
                    <Button onClick={() => setAnnouncementOpen(true)} color="success" sx={{ fontWeight: 600 }}>Annonce</Button>
                    <Button component={Link} to="/logs" color="secondary" sx={{ fontWeight: 700 }}>Log Admin</Button>
                  </>
                )}
              </>
            )}
            
            {token && (
              <IconButton color="inherit" onClick={handleBellClick} sx={{ mr: 1 }}>
                <Badge badgeContent={unreadCount} color="error">
                  {unreadCount > 0 ? <NotificationsActiveIcon color="primary" /> : <NotificationsIcon />}
                </Badge>
              </IconButton>
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

      {/* Popover Notifications */}
      <Popover
        open={openPopover}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            mt: 1.5,
            width: 380,
            maxHeight: 480,
            overflow: 'auto',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          }
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAllAsRead} sx={{ fontWeight: 600 }}>
              Tout lire
            </Button>
          )}
        </Box>
        <Divider />
        <List sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <ListItem sx={{ py: 3 }}>
              <ListItemText
                primary="Aucune notification"
                primaryTypographyProps={{ align: 'center', color: 'text.secondary' }}
              />
            </ListItem>
          ) : (
            notifications.map((notif) => (
              <React.Fragment key={notif.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    backgroundColor: notif.is_read ? 'transparent' : 'rgba(37, 99, 235, 0.05)',
                    transition: 'background-color 0.2s',
                    py: 1.5,
                  }}
                  secondaryAction={
                    !notif.is_read && (
                      <Tooltip title="Marquer comme lu">
                        <IconButton size="small" onClick={(e) => handleMarkAsRead(notif.id, e)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )
                  }
                >
                  <Box sx={{ mr: 2, mt: 0.5 }}>
                    {getNotificationIcon(notif.type)}
                  </Box>
                  <ListItemText
                    primary={notif.title}
                    secondary={
                      <React.Fragment>
                        <Typography
                          sx={{ display: 'inline', fontWeight: notif.is_read ? 400 : 600 }}
                          component="span"
                          variant="body2"
                          color="text.primary"
                        >
                          {notif.message}
                        </Typography>
                        <Typography
                          sx={{ display: 'block', mt: 0.5, fontSize: '0.75rem', opacity: 0.7 }}
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          {new Date(notif.created_at || Date.now()).toLocaleTimeString()} - {new Date(notif.created_at || Date.now()).toLocaleDateString()}
                        </Typography>
                      </React.Fragment>
                    }
                    primaryTypographyProps={{
                      fontWeight: notif.is_read ? 600 : 800,
                      color: notif.is_read ? 'text.secondary' : 'text.primary',
                    }}
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))
          )}
        </List>
      </Popover>

      {/* Floating Toast Notification */}
      {toast && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 320,
            zIndex: 9999,
            p: 2,
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#fff',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
            animation: 'slideIn 0.3s ease-out',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            {getNotificationIcon(toast.type)}
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#fff' }}>
              {toast.title}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setToast(null)}
              sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', wordBreak: 'break-word' }}>
            {toast.message}
          </Typography>
        </Box>
      )}

      {/* Announcement Dialog */}
      <Dialog open={announcementOpen} onClose={() => setAnnouncementOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Diffuser une annonce globale</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleBroadcast} sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Titre de l'annonce"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Message"
              value={annMsg}
              onChange={(e) => setAnnMsg(e.target.value)}
              multiline
              rows={3}
              fullWidth
              required
            />
            <DialogActions sx={{ px: 0, pb: 0, mt: 1 }}>
              <Button onClick={() => setAnnouncementOpen(false)}>Annuler</Button>
              <Button type="submit" variant="contained" color="success">
                Diffuser
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>
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

const LOGS_QUERY = gql`
  query GetLogs(
    $log_type: String
    $level: String
    $module: String
    $username: String
    $action: String
    $search: String
    $page: Int
    $limit: Int
  ) {
    logs(
      log_type: $log_type
      level: $level
      module: $module
      username: $username
      action: $action
      search: $search
      page: $page
      limit: $limit
    ) {
      logs {
        id
        log_type
        level
        message
        module
        user_id
        username
        action
        resource
        context
        created_at
      }
      total
      pages
    }
  }
`;

function LogsPage() {
  const [logType, setLogType] = useState('');
  const [level, setLevel] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  const [selectedLog, setSelectedLog] = useState(null);

  const { data, loading } = useQuery(LOGS_QUERY, {
    variables: {
      log_type: logType || null,
      level: level || null,
      module: moduleName || null,
      search: search || null,
      page,
      limit,
    },
    fetchPolicy: 'network-only',
  });

  const getLevelColor = (lvl) => {
    switch (lvl) {
      case 'ERROR': return 'error';
      case 'WARN': return 'warning';
      case 'INFO': return 'info';
      case 'DEBUG': return 'default';
      default: return 'default';
    }
  };

  const formatContext = (ctx) => {
    if (!ctx) return 'Aucun contexte.';
    try {
      const parsed = JSON.parse(ctx);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return ctx;
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <Box>
      <Paper className="panel" sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
          Centre d'Administration des Logs
        </Typography>

        {/* Filters */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Rechercher..."
              variant="outlined"
              fullWidth
              value={search}
              onChange={handleSearchChange}
              placeholder="Message, utilisateur, action..."
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Type de Log</InputLabel>
              <Select
                value={logType}
                label="Type de Log"
                onChange={handleFilterChange(setLogType)}
              >
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="APPLICATION">APPLICATION</MenuItem>
                <MenuItem value="AUDIT">AUDIT</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Niveau</InputLabel>
              <Select
                value={level}
                label="Niveau"
                onChange={handleFilterChange(setLevel)}
              >
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="DEBUG">DEBUG</MenuItem>
                <MenuItem value="INFO">INFO</MenuItem>
                <MenuItem value="WARN">WARN</MenuItem>
                <MenuItem value="ERROR">ERROR</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Module</InputLabel>
              <Select
                value={moduleName}
                label="Module"
                onChange={handleFilterChange(setModuleName)}
              >
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="auth-service">auth-service</MenuItem>
                <MenuItem value="vehicle-service">vehicle-service</MenuItem>
                <MenuItem value="traffic-service">traffic-service</MenuItem>
                <MenuItem value="incident-service">incident-service</MenuItem>
                <MenuItem value="gateway">gateway</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Logs Table */}
        {loading ? (
          <LinearProgress />
        ) : (
          <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Horodatage</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Niveau</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Acteur / Action</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Détails</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(!data || !data.logs || data.logs.logs.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Aucun log trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.logs.logs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>{new Date(Number(log.created_at)).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.log_type}
                          size="small"
                          color={log.log_type === 'AUDIT' ? 'secondary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.level}
                          size="small"
                          color={getLevelColor(log.level)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {log.module}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.message}
                      </TableCell>
                      <TableCell>
                        {log.log_type === 'AUDIT' ? (
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                              {log.username || `ID: ${log.user_id}`}
                            </Typography>
                            <Chip label={log.action} size="small" variant="outlined" color="primary" sx={{ fontSize: '0.7rem', height: 20 }} />
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.disabled">N/A</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={() => setSelectedLog(log)} color="primary" size="small">
                          <EyeIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {data && data.logs && data.logs.pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Page {page} sur {data.logs.pages} ({data.logs.total} logs au total)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                disabled={page === 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              >
                Précédent
              </Button>
              <Button
                variant="outlined"
                disabled={page === data.logs.pages}
                onClick={() => setPage(prev => Math.min(prev + 1, data.logs.pages))}
              >
                Suivant
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.15)',
          }
        }}
      >
        {selectedLog && (
          <>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Détails du Log</Typography>
                <Chip label={`ID: ${selectedLog.id}`} size="small" variant="outlined" />
              </Box>
              <IconButton onClick={() => setSelectedLog(null)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.disabled">Horodatage</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{new Date(Number(selectedLog.created_at)).toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.disabled">Type de Log</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip label={selectedLog.log_type} color={selectedLog.log_type === 'AUDIT' ? 'secondary' : 'default'} />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.disabled">Niveau de Sévérité</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip label={selectedLog.level} color={getLevelColor(selectedLog.level)} />
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.disabled">Module Source</Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedLog.module}</Typography>
                </Grid>

                {selectedLog.log_type === 'AUDIT' && (
                  <>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.disabled">Action Auditée</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>{selectedLog.action}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.disabled">Ressource Touchée</Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{selectedLog.resource || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.disabled">Utilisateur Responsable</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedLog.username || `ID: ${selectedLog.user_id || 'N/A'}`}</Typography>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.disabled">Message du Log</Typography>
                  <Paper variant="outlined" sx={{ p: 2, background: 'rgba(0,0,0,0.02)', borderStyle: 'dashed' }}>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {selectedLog.message}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.disabled">Données de Contexte (ou Stack Trace)</Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      background: '#1e1e1e',
                      color: '#4fc1ff',
                      fontFamily: 'Consolas, monospace',
                      fontSize: '0.85rem',
                      overflowX: 'auto',
                      maxHeight: '250px',
                    }}
                  >
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {formatContext(selectedLog.context)}
                    </pre>
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedLog(null)} variant="contained">Fermer</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (!token || !user || user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return children;
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
        <Route
          path="/logs"
          element={
            <RequireAdmin>
              <LogsPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
