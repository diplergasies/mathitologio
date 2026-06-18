'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Ασφαλές API προς το renderer (χωρίς nodeIntegration).
contextBridge.exposeInMainWorld('api', {
  importXlsx: () => ipcRenderer.invoke('import:xlsx'),

  listStudents: (status) => ipcRenderer.invoke('students:list', status),
  enrollOptions: (id) => ipcRenderer.invoke('students:enrollOptions', id),
  enroll: (id, schoolId) => ipcRenderer.invoke('students:enroll', { id, schoolId }),
  setSchool: (id, schoolId) => ipcRenderer.invoke('students:setSchool', { id, schoolId }),
  deleteStudent: (id) => ipcRenderer.invoke('students:delete', id),
  restoreStudent: (id) => ipcRenderer.invoke('students:restore', id),
  updateStudent: (id, fields) => ipcRenderer.invoke('students:update', { id, fields }),

  listSchools: () => ipcRenderer.invoke('schools:list'),
  addSchool: (name, type) => ipcRenderer.invoke('schools:add', { name, type }),
  updateSchool: (id, name, type) => ipcRenderer.invoke('schools:update', { id, name, type }),
  deleteSchool: (id) => ipcRenderer.invoke('schools:delete', id),

  gradesForType: (type) => ipcRenderer.invoke('grades:forType', type),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (obj) => ipcRenderer.invoke('settings:set', obj),

  getSchoolYear: () => ipcRenderer.invoke('schoolYear:get'),
  setSchoolYear: (nipYear) => ipcRenderer.invoke('schoolYear:set', nipYear),

  listTemplates: () => ipcRenderer.invoke('documents:list'),
  generateDocument: (id, templateFile) =>
    ipcRenderer.invoke('documents:generate', { id, templateFile }),

  bulkDelete: (ids) => ipcRenderer.invoke('students:bulkDelete', ids),
  bulkRestore: (ids) => ipcRenderer.invoke('students:bulkRestore', ids),
  purgeStudent: (id) => ipcRenderer.invoke('students:purge', id),
  bulkPurge: (ids) => ipcRenderer.invoke('students:bulkPurge', ids),
  bulkEnroll: (ids, mode, schoolId) =>
    ipcRenderer.invoke('students:bulkEnroll', { ids, mode, schoolId }),
  bulkGenerate: (ids, templateFiles) =>
    ipcRenderer.invoke('documents:bulkGenerate', { ids, templateFiles }),

  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),

  appInfo: () => ipcRenderer.invoke('app:info'),
  getReadme: () => ipcRenderer.invoke('help:readme'),
})
