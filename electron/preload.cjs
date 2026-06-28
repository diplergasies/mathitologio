'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Ασφαλές API προς το renderer (χωρίς nodeIntegration).
contextBridge.exposeInMainWorld('api', {
  importXlsx: () => ipcRenderer.invoke('import:xlsx'),
  importPdf: () => ipcRenderer.invoke('import:pdf'),

  listStudents: (status) => ipcRenderer.invoke('students:list', status),
  enrollOptions: (id) => ipcRenderer.invoke('students:enrollOptions', id),
  enroll: (id, schoolId) => ipcRenderer.invoke('students:enroll', { id, schoolId }),
  setSchool: (id, schoolId) => ipcRenderer.invoke('students:setSchool', { id, schoolId }),
  deleteStudent: (id, reason) => ipcRenderer.invoke('students:delete', { id, reason }),
  restoreStudent: (id) => ipcRenderer.invoke('students:restore', id),
  updateStudent: (id, fields) => ipcRenderer.invoke('students:update', { id, fields }),

  listSchools: () => ipcRenderer.invoke('schools:list'),
  addSchool: (name, type, dyep, ty) => ipcRenderer.invoke('schools:add', { name, type, dyep, ty }),
  updateSchool: (id, name, type, dyep, ty) =>
    ipcRenderer.invoke('schools:update', { id, name, type, dyep, ty }),
  deleteSchool: (id) => ipcRenderer.invoke('schools:delete', id),

  gradesForType: (type) => ipcRenderer.invoke('grades:forType', type),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (obj) => ipcRenderer.invoke('settings:set', obj),

  getSchoolYear: () => ipcRenderer.invoke('schoolYear:get'),
  setSchoolYear: (nipYear) => ipcRenderer.invoke('schoolYear:set', nipYear),

  listTemplates: () => ipcRenderer.invoke('documents:list'),
  addTemplate: () => ipcRenderer.invoke('templates:add'),
  deleteTemplate: (file) => ipcRenderer.invoke('templates:delete', file),
  generateDocument: (id, templateFile, signee) =>
    ipcRenderer.invoke('documents:generate', { id, templateFile, signee }),

  bulkDelete: (ids, reason) => ipcRenderer.invoke('students:bulkDelete', { ids, reason }),
  bulkRestore: (ids) => ipcRenderer.invoke('students:bulkRestore', ids),
  purgeStudent: (id) => ipcRenderer.invoke('students:purge', id),
  bulkPurge: (ids) => ipcRenderer.invoke('students:bulkPurge', ids),
  bulkEnroll: (ids, mode, schoolId) =>
    ipcRenderer.invoke('students:bulkEnroll', { ids, mode, schoolId }),

  promotionPreview: () => ipcRenderer.invoke('promotion:preview'),
  applyPromotion: (ids) => ipcRenderer.invoke('promotion:apply', ids),
  bulkGenerate: (ids, templateFiles, signee) =>
    ipcRenderer.invoke('documents:bulkGenerate', { ids, templateFiles, signee }),

  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  chooseBackupFolder: () => ipcRenderer.invoke('backup:chooseFolder'),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  listBackups: () => ipcRenderer.invoke('backup:list'),

  appInfo: () => ipcRenderer.invoke('app:info'),
  getReadme: () => ipcRenderer.invoke('help:readme'),

  monthlyStats: (period) => ipcRenderer.invoke('stats:monthly', period),
  observatoryStats: (period) => ipcRenderer.invoke('stats:observatory', period),
})
