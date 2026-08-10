// Connexion WebSocket à Home Assistant : états en direct et appels de service.
// Se reconnecte toute seule, et prévient l'interface de son statut.

export class HomeAssistant {
  constructor({ url, token }) {
    this.url = url || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/websocket`;
    this.token = token;
    this.states = new Map();
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.socket = null;
    this.nextId = 1;
    this.retryMs = 1000;
    this.status = 'wait';
  }

  get ready() {
    return this.status === 'on';
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  onStatus(fn) {
    this.statusListeners.add(fn);
    fn(this.status);
  }

  // Abonnement à un type d'événement du bus (ex: ceux émis par un boîtier
  // ESPHome). L'abonnement est repassé à chaque reconnexion.
  onEvent(type, fn) {
    this.eventListeners ??= new Map();
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
      if (this.status === 'on') this.send({ type: 'subscribe_events', event_type: type });
    }
    this.eventListeners.get(type).add(fn);
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  state(entityId) {
    return this.states.get(entityId) || null;
  }

  connect() {
    if (!this.token || this.token.startsWith('COLLER')) {
      console.warn('Jeton Home Assistant absent : voir config.js');
      this.setStatus('off');
      return;
    }

    let socket;
    try {
      socket = new WebSocket(this.url);
    } catch (err) {
      console.error('WebSocket impossible', err);
      this.scheduleRetry();
      return;
    }

    this.socket = socket;

    socket.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'auth_required') {
        socket.send(JSON.stringify({ type: 'auth', access_token: this.token }));
      } else if (msg.type === 'auth_ok') {
        this.retryMs = 1000;
        this.send({ type: 'subscribe_events', event_type: 'state_changed' });
        this.eventListeners?.forEach((_, type) => this.send({ type: 'subscribe_events', event_type: type }));
        this.send({ type: 'get_states' }, (result) => {
          result.forEach((s) => this.states.set(s.entity_id, s));
          this.setStatus('on');
          this.emit();
        });
      } else if (msg.type === 'auth_invalid') {
        console.error('Jeton Home Assistant refusé');
        this.setStatus('off');
        socket.close();
      } else if (msg.type === 'result' && this.pending?.has(msg.id)) {
        const fn = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        fn(msg.success ? msg.result : null, msg.success, msg.error);
      } else if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
        const { entity_id: id, new_state: next } = msg.event.data;
        if (next) this.states.set(id, next);
        else this.states.delete(id);
        this.emit(id);
      } else if (msg.type === 'event' && this.eventListeners?.has(msg.event?.event_type)) {
        this.eventListeners.get(msg.event.event_type).forEach((fn) => fn(msg.event.data || {}, msg.event));
      }
    });

    socket.addEventListener('close', () => {
      if (this.status !== 'off') this.setStatus('wait');
      this.scheduleRetry();
    });

    socket.addEventListener('error', () => socket.close());
  }

  scheduleRetry() {
    if (this.status === 'off') return;
    setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 30000);
  }

  send(payload, onResult) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const id = this.nextId++;
    if (onResult) {
      this.pending ??= new Map();
      this.pending.set(id, onResult);
    }
    this.socket.send(JSON.stringify({ ...payload, id }));
  }

  // Variante promesse, pour les commandes qui rendent des données (historique).
  ask(payload) {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        reject(new Error('Home Assistant hors ligne'));
        return;
      }
      this.send(payload, (result, ok, error) => {
        if (ok) resolve(result);
        else reject(new Error(error?.message || 'requête refusée'));
      });
    });
  }

  emit(entityId) {
    this.listeners.forEach((fn) => fn(entityId));
  }

  callService(domain, service, entityId, data = {}) {
    this.send({
      type: 'call_service',
      domain,
      service,
      target: entityId ? { entity_id: entityId } : undefined,
      service_data: data,
    });
  }
}

// Valeur numérique d'un capteur, arrondie, ou null si indisponible.
export function numeric(state, decimals = 1) {
  if (!state || state.state === 'unavailable' || state.state === 'unknown') return null;
  const value = Number(state.state);
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
