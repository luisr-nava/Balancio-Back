// test-socket.js
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000', {
  auth: {
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5MGEyZThkMi04OWRkLTQ0N2ItOGEyNS1hOTdiYTk1OWM4MWMiLCJyb2xlIjoiT1dORVIiLCJvd25lcklkIjpudWxsLCJlbWFpbCI6Im5hdmFsdWlzcm9kb2xmb0BnbWFpbC5jb20iLCJpYXQiOjE3NzE2NzE5NjUsImV4cCI6MTc3MTc1ODM2NX0.kbfjRL4-3PWCEfwDAiZ8yb66KBU_9RxVoqD9Lkh8DX8',
  },
});

socket.on('notification', (data) => {
  console.log('Notificación recibida:', data);
});

socket.on('connect', () => {
  console.log('Conectado:', socket.id);
});
