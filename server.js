const express = require('express');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const socket = require('socket.io');
const port = 9090;
var users;
var count;
var chatRooms;
var groups;
var messages = [];
var messageArray = [];
var chatHistory = [];

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const MongoClient = mongodb.MongoClient;

app.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin' , 'http://localhost:4200');
    res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.append("Access-Control-Allow-Headers", "Origin, Accept,Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
    res.append('Access-Control-Allow-Credentials', true);
    next();
});


MongoClient.connect('mongodb://localhost:27017/Chat_App', (err, Database) => {
    if(err) {
        console.log(err);
        return false;
    }
    else{
        console.log("Connected to MongoDB");
        const db = Database.db("Chat_App");
        users = db.collection("users");
        chatRooms = db.collection("chatRooms");
        groups = db.collection("groups");
        const server = app.listen(port, () => {
        console.log("Server started on port " + port + "...");
        });
        io = socket.listen(server);
        io.sockets.on('connection', (socket) => {
            console.log("socket connected>>>>", socket.id);
            socket.on('join', (data) => {
                socket.join(data.room);
                console.log("data>>>>", data);
                chatRooms.find({}).toArray((err, rooms) => {
                    if(err){
                        console.log("err>>>>>", err);
                        return false;
                    }
                    else{
                        count = 0;
                        console.log("rooms>>>>" ,rooms);
                        rooms.forEach((room) => {
                            if(room.name == data.room){
                            console.log("room >>>", room);
                            count++;
                            messageArray = room.messages
                            console.log("count$#%%%#$%", count);
                            // console.log("messageArray>>>>>>", messageArray)
                            // socket.emit('getMessages', messageArray);
                            }
                        });
                        if(count == 0) {
                        console.log("count insert one >>>");
                        chatRooms.insertOne({ name: data.room, messages: [] }); 
                        }
                    }
                    
                });
            });
            socket.on('message', (data) => {
                console.log("message from server@!#@#!#!$!$$$$", data);
                io.in(data.room).emit('new message', {user: data.user, message: data.message});
                chatRooms.updateOne({name: data.room}, { $push: { messages: { user: data.user, message: data.message } } }, (err, res) => {
                    if(err) {
                        console.log(err);
                        return false;
                    }
                    else{
                        console.log("Document updated");
                    }
                    
                });
            });
            socket.on('typing', (data) => {
                // console.log("data from typing server&&&&&&&&&&", data);
                socket.broadcast.in(data.room).emit('typing', {data: data, isTyping: true});            
            });
            socket.on('groupTyping', (data) => {
                console.log("data from typing server&&&&&&&&&&", data);
                socket.broadcast.in(data.room).emit('groupTyping', {user: data.user, isTyping: true});            
            });
        });
    }

}); 

// app.get('/', (req, res, next) => {
//     res.send('Welcome to the express server...');
// });

app.get('/chatroom/:room', (req, res, next) => {
  
    console.log("inside chatroom/:room>>>>>>", req.params.room);
    chatRooms.find({name: req.params.room}, {}).toArray((err, chatroom) => {
        if(err) {
            console.log(err);
            return false;
        }
        else{
        console.log("getting chatroom", chatroom);
        res.status(200).json(chatroom);
        }
    });
});

app.post('/user/register', (req, res, next) => {
	console.log("inside user/register>>>", req.body);

    let user = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        isOnline : false
    };
    let count = 0;    
    users.find({}, (err, Users) => {
        if (err) {
            console.log(err);
            return res.status(500).send(err);
        }
        else{
            console.log("Users.find>>>>>>>");
            for(let i = 0; i < Users.length; i++){
                if(Users[i].username == user.username)
                    count++;
            }
            // Add user if not already signed up
            if(count == 0){
                users.insertOne(user, (err, User) => {
                    if(err){
                        res.send(err);
                    }
                    else{
                        console.log("user>>>>>>>>", user);   
                        io.emit("New_User_Registered",user);    
                        res.status(200).json(user);
                    }
                });
            }
            else {
                // Alert message logic here
                res.json({ user_already_signed_up: true });
            }    
        }
    
    });
    
});

app.post('/user/group', (req, res, next) => {
    console.log("inside user/group>>>", req.body);
    console.log("req.body>>>>>>>>", req.body);
    let group = req.body;
      
    groups.find({}).toArray((err, Groups) => {
        if (err) {
            console.log("err>>>> ",err);
            return res.status(500).send(err);
        }
        else{
                let count = 0; 
                console.log("No error in groups find");
                Groups.forEach((group) => {
                    if(group.groupName === req.body.groupName){
                    count++;
                    }
                });
                   console.log("count$#%%%#$%", count);
            // Add group if not already created
            if(count == 0){
                groups.insertOne(group, (err, User) => {
                    if(err){
                        console.log("unable to insert");
                        res.status(500).send(err);
                    }
                    else{
                    console.log("group created", User.ops[0]);
                    res.status(200).json(User);
                    }
                });
            }
            else {
                console.log("group exists");
                res.json({ group_already_exists: true });
            }    
        }
    
    });
    
});

app.post('/user/auth', (req, res) => {
    try
    {

        if(!req.body.email){
           res.status(500).json({success: false, message : "Please provide email"});
           console.log("Email is not provided");

        }

       else if(!req.body.password){    
           res.status(500).json({success: false, message : "Please provide password"});
           console.log("Password is not provided");   
       }

       else{

            users.findOneAndUpdate({"email" : req.body.email, "password" : req.body.password}, {$set : {isOnline : true}}, {returnOriginal: false},(err,loggedInUser) =>
            {   
                if(err){
                console.log("error in find and update", err);   
                }
                else{
                    console.log("loggedInUser", loggedInUser.value);
                    if(!loggedInUser.value){
                    console.log("Both credentials are not true");  
                    }
                    else{
                    isPresent = true;
                    correctPassword = true;
                    console.log("user found and authorized>>>>>>", loggedInUser.value) 
                    io.emit("logged_in_user",loggedInUser.value);   
                    res.status(200).json({ isPresent: isPresent, correctPassword: correctPassword, user: loggedInUser.value });
                    }
                       
                }

            })

        }
    }    
    catch(e){
    console.log("exception e>>" , e);
    res.status(500).json(e)
    }



});


app.post('/user/logOut', (req, res, next) =>
{ 
  console.log("users.logout api hitting");
  let email = req.body.email;
  console.log("email from api@@@", email);

    users.findOneAndUpdate({"email" : req.body.email}, {$set : {isOnline : false}}, {returnOriginal: false}, (err, foundUser) =>
    {
        console.log("foundUser logout>>>>>", foundUser);
        if(err){
            console.log("err in user logOut", err);
        }
        else{
            // if(!foundUser.value){
            console.log("logout user>>>>>>>", foundUser);
            // }

            io.emit("log_Out_User",foundUser.value);   
            res.status(200).json(foundUser.value);
        }
    })

});

app.get('/user/getAllUsers', (req, res, next) => {
    users.find({}).toArray((err, users) => {
        if(err) {

            res.send(err);
        }
        else
            res.status(200).json(users);
    });
});

app.get('/user/getAllGroups/:username', (req, res) => {
    console.log("req.params.username", req.params.username);
    let username = req.params.username
    groups.find({groupMembers : username}).toArray((err, groups) => {
        if(err) {

            res.send(err);
        }
        else
            console.log("groups", groups)
            res.status(200).json(groups);
    });
});


