const KEY="pixelgalaxy-v2",R=["energy","metal","crystal","credits"];
const B={
solar:{n:"Solar Array",d:"Makes energy",c:{metal:10},p:{energy:1}},
foundry:{n:"Metal Foundry",d:"Refines metal",c:{energy:10},p:{metal:.8}},
mine:{n:"Crystal Mine",d:"Digs crystal",c:{metal:25,energy:10},p:{crystal:.6}},
hub:{n:"Trade Hub",d:"Earns credits",c:{metal:30,crystal:20},p:{credits:.5}},
hangar:{n:"Hangar",d:"Holds 5 ship slots per level",c:{metal:40,crystal:30},p:{}},
command:{n:"Command Station",d:"Raises building cap, storage and fleet power",c:{metal:60,crystal:40,credits:20},p:{}}
};
const U={
fighter:{n:"Fighter",pw:1,sz:1,h:1,c:{energy:10,credits:5}},
cruiser:{n:"Cruiser",pw:3,sz:2,h:2,c:{metal:25,crystal:10,credits:10}},
capital:{n:"Capital Ship",pw:8,sz:4,h:4,c:{metal:80,crystal:50,credits:40}}
};
const WEAK={swarm:"fighter",armored:"cruiser",fortress:"capital"};
const SYS=[
{n:"Home World",x:16,y:40,l:[1,2]},
{n:"Pirate Outpost",t:"swarm",pw:5,r:{metal:60,credits:20},x:42,y:20,l:[0,3]},
{n:"Derelict Station",t:"armored",pw:12,r:{crystal:80,credits:50},x:42,y:62,l:[0,4,5]},
{n:"Rogue Belt",t:"swarm",pw:28,r:{energy:150,credits:120},x:72,y:12,l:[1,6]},
{n:"Void Foundry",t:"armored",pw:45,r:{metal:300,credits:150},x:70,y:42,l:[2,6]},
{n:"Nebula Fortress",t:"fortress",pw:90,r:{credits:300,crystal:150},x:72,y:70,l:[2,7]},
{n:"Raider Armada",t:"swarm",pw:160,r:{credits:800,metal:300,crystal:300},x:100,y:24,l:[3,4,7]},
{n:"Alien Hive Core",t:"fortress",pw:260,r:{credits:2000},x:108,y:56,l:[5,6]}
];
