var express=require('express');var jwtAuth=require('../../../middleware/jwtAuth');var requirePerm=require('../../../middleware/rbac');var h=require('./syncSourcesHandlers');var router=express.Router();
router.get('/',jwtAuth,requirePerm('kb:sync'),h.listSyncSources);
router.post('/',jwtAuth,requirePerm('kb:sync'),h.createSyncSource);
router.put('/:id',jwtAuth,requirePerm('kb:sync'),h.updateSyncSource);
router.delete('/:id',jwtAuth,requirePerm('kb:sync'),h.deleteSyncSource);
router.get('/:id/status',jwtAuth,requirePerm('kb:sync'),h.getSyncSourceStatus);
router.post('/:id/trigger-import',jwtAuth,requirePerm('kb:sync'),h.triggerImport);
module.exports=router;
