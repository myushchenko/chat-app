const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, getUser, getUsersInRoom, removeUser } = require('./utils/users');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR_PATH = path.join(__dirname, '../public');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(PUBLIC_DIR_PATH));

io.on('connection', socket => {
	console.log('New WebSocket connection');

	socket.on('join', (options, callback) => {
		const { error, user } = addUser({ id: socket.id, ...options });

		if (error) {
			return callback(error);
		}

		socket.join(user.room);

		socket.emit('message', generateMessage('Admin', 'Welcome!'));

		socket.broadcast
			.to(user.room)
			.emit('message', generateMessage('Admin', `${user.username} has joined!`));

		io.to(user.room).emit('roomData', {
			room: user.room,
			users: getUsersInRoom(user.room)
		});

		callback();
	});

	socket.on('sendMessage', (message, callback) => {
		const filter = new Filter();
		const user = getUser(socket.id);

		if (filter.isProfane(message)) {
			return callback('Profanity is not allowed!');
		}
		io.to(user.room).emit('message', generateMessage(user.username, message));
		callback();
	});

	socket.on('sendLocation', (coords, callback) => {
		const user = getUser(socket.id);
		io.to(user.room).emit(
			'locationMessage',
			generateLocationMessage(
				user.username,
				`https://google.com/maps?q=${coords.latitude},${coords.longitude}`
			)
		);
		callback();
	});

	socket.on('disconnect', () => {
		const user = removeUser(socket.id);

		if (user) {
			io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`));

			io.to(user.room).emit('roomData', {
				room: user.room,
				users: getUsersInRoom(user.room)
			});
		}
	});
});

server.listen(PORT, () => {
	console.log(`Server is up on ${PORT}`);
});

/*
socket.emit - message to current user
io.emit - message to all users
socket.broadcast.emit -  message to all users except current

socket.join(room);
io.to().emit - message to all users of Room
socket.broadcast.to().emit -  message to all users of Room except current
*/
