// Tiny document database. Everything lives in memory and is flushed to disk
// (data/db.json) or, when MONGODB_URI is set, to a single MongoDB document.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.GMAI_DATA || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');
const MONGO_URI = process.env.MONGODB_URI;

let db = null;
let timer = null;
let mongo = null;
let storageError = '';
let files = null; // MongoDB collection for attachments

async function load() {
  if (MONGO_URI) {
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
      await client.connect();
      mongo = client.db(process.env.MONGODB_DB || 'gmai').collection('state');
      files = client.db(process.env.MONGODB_DB || 'gmai').collection('files');
      const doc = await mongo.findOne({ _id: 'db' });
      if (doc) db = JSON.parse(doc.json);
      else { db = require('./seed').buildSeed(); await flush(); }
      console.log('Storage: MongoDB');
      return db;
    } catch (e) {
      // Keep the app online; data then lives on local disk until MongoDB is reachable.
      mongo = null;
      files = null;
      storageError = e.message;
      console.error('WARNING: could not connect to MongoDB (' + e.message + '). Check the Atlas IP Access List allows 0.0.0.0/0. Using local storage for now.');
    }
  }
  if (fs.existsSync(FILE)) {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } else {
    db = require('./seed').buildSeed();
    flush();
  }
  console.log('Storage: ' + FILE);
  return db;
}

function reset() {
  db = require('./seed').buildSeed();
  flush();
  return db;
}

function get() {
  return db;
}

function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 150);
}

async function flush() {
  if (mongo) {
    // Stored as a JSON string so keys like phone numbers and dots are safe.
    try { await mongo.replaceOne({ _id: 'db' }, { _id: 'db', json: JSON.stringify(db), savedAt: new Date() }, { upsert: true }); } catch (e) { console.error('Mongo save failed:', e.message); }
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const json = JSON.stringify(db, null, 1);
  const tmp = FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, FILE);
  } catch {
    // OneDrive / antivirus can lock the file during rename; fall back to a direct write.
    fs.writeFileSync(FILE, json);
  }
}

function id(prefix) {
  return prefix + '_' + crypto.randomBytes(6).toString('hex');
}

function hashSecret(secret) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 32).toString('hex');
  return salt + ':' + hash;
}

function verifySecret(secret, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(secret), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

function digits(n) {
  let s = String(Math.floor(Math.random() * 9) + 1);
  while (s.length < n) s += Math.floor(Math.random() * 10);
  return s;
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

function status() {
  return { storage: mongo ? 'mongodb' : 'disk', mongoConfigured: !!MONGO_URI, error: storageError };
}

// Attachments live outside the main document: MongoDB collection "files", or data/files/<id>.
async function putFile(fid, meta, base64) {
  if (files) { await files.replaceOne({ _id: fid }, { _id: fid, ...meta, data: base64 }, { upsert: true }); return; }
  const dir = path.join(DATA_DIR, 'files');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fid), Buffer.from(base64, 'base64'));
}
async function getFile(fid) {
  if (files) { const f = await files.findOne({ _id: fid }); return f ? Buffer.from(f.data, 'base64') : null; }
  const p = path.join(DATA_DIR, 'files', path.basename(fid));
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}
async function deleteFile(fid) {
  if (files) { await files.deleteOne({ _id: fid }); return; }
  const p = path.join(DATA_DIR, 'files', path.basename(fid));
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = { putFile, getFile, deleteFile, status, load, reset, get, save, flush, id, hashSecret, verifySecret, digits, token };
