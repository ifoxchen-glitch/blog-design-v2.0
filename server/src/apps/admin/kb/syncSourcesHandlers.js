var path=require('path');var dbLib=require('../../../db');var kbSync=require('../../../services/kbSync');var nowIso=require('../../../utils').nowIso;

function getDb(){return dbLib.openDb()}

exports.listSyncSources=function(req,res){try{var rows=getDb().prepare('SELECT * FROM sync_sources ORDER BY created_at DESC').all();res.json({code:0,data:rows})}catch(e){res.status(500).json({code:500,message:e.message})}};

exports.createSyncSource=function(req,res){try{var b=req.body;if(!b.name||!b.type){return res.status(400).json({code:400,message:'name and type required'})}var now=nowIso();var info=getDb().prepare('INSERT INTO sync_sources (name,type,config,enabled,created_at,updated_at) VALUES (?,?,?,1,?,?)').run(b.name,b.type,JSON.stringify(b.config||{}),now,now);res.json({code:0,data:{id:info.lastInsertRowid}})}catch(e){res.status(500).json({code:500,message:e.message})}};

exports.updateSyncSource=function(req,res){try{var b=req.body;var now=nowIso();getDb().prepare('UPDATE sync_sources SET name=COALESCE(?,name),type=COALESCE(?,type),config=COALESCE(?,config),enabled=COALESCE(?,enabled),updated_at=? WHERE id=?').run(b.name||null,b.type||null,b.config?JSON.stringify(b.config):null,b.enabled!==undefined?(b.enabled?1:0):null,now,req.params.id);res.json({code:0})}catch(e){res.status(500).json({code:500,message:e.message})}};

exports.deleteSyncSource=function(req,res){try{getDb().prepare('DELETE FROM sync_sources WHERE id=?').run(req.params.id);res.json({code:0})}catch(e){res.status(500).json({code:500,message:e.message})}};

exports.getSyncSourceStatus=function(req,res){try{var src=getDb().prepare('SELECT * FROM sync_sources WHERE id=?').get(req.params.id);if(!src)return res.status(404).json({code:404,message:'not found'});var logs=getDb().prepare('SELECT * FROM kb_sync_logs WHERE source_id=? ORDER BY created_at DESC LIMIT 20').all(req.params.id);res.json({code:0,data:{source:src,recentLogs:logs}})}catch(e){res.status(500).json({code:500,message:e.message})}};

exports.triggerImport=function(req,res){try{var src=getDb().prepare('SELECT * FROM sync_sources WHERE id=?').get(req.params.id);if(!src)return res.status(404).json({code:404,message:'not found'});if(src.type==='openwebui'){kbSync.fullSyncFromOpenWebUI(src).then(function(r){res.json({code:0,data:r})})}else{res.json({code:0,message:'import triggered'})}}catch(e){res.status(500).json({code:500,message:e.message})}};
