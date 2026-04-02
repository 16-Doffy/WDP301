import { API_URL } from '../config/api';
const BASE = API_URL + '/api/topics';
const SBASE = API_URL + '/api/subtopics';
const LBASE = API_URL + '/api/labelsets';
const getToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');
const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() });

export const getTopics = () => fetch(BASE, { headers: headers() }).then(r => r.json());
export const getTopic = (id) => fetch(BASE + '/' + id, { headers: headers() }).then(r => r.json());
export const createTopic = (data) => fetch(BASE, {method:'POST',headers:headers(),body:JSON.stringify(data)}).then(r => r.json());
export const updateTopic = (id, data) => fetch(BASE + '/' + id, {method:'PUT',headers:headers(),body:JSON.stringify(data)}).then(r => r.json());
export const deleteTopic = (id) => fetch(BASE + '/' + id, {method:'DELETE',headers:headers()}).then(r => r.json());

export const getSubtopics = (topicId) => {const url=topicId?SBASE+'?topicId='+topicId:SBASE;return fetch(url, {headers:headers()}).then(r => r.json());};
export const getSubtopic = (id) => fetch(SBASE + '/' + id, {headers:headers()}).then(r => r.json());
export const createSubtopic = (data) => fetch(SBASE, {method:'POST',headers:headers(),body:JSON.stringify(data)}).then(r => r.json());
export const updateSubtopic = (id, data) => fetch(SBASE + '/' + id, {method:'PUT',headers:headers(),body:JSON.stringify(data)}).then(r => r.json());
export const deleteSubtopic = (id) => fetch(SBASE + '/' + id, {method:'DELETE',headers:headers()}).then(r => r.json());

export const getLabelSets = (subtopicId) => {const url=subtopicId?LBASE+'?subtopicId='+subtopicId:LBASE;return fetch(url, {headers:headers()}).then(r => r.json());};
export const getLabelSet = (id) => fetch(LBASE + '/' + id, {headers:headers()}).then(r => r.json());
export const createLabelSet = (data) => fetch(LBASE, {method:'POST',headers:headers(),body:JSON.stringify(data)}).then(r => r.json());
export const updateLabelSet = (id, data) => fetch(LBASE + '/' + id, {method:'PUT',headers:headers(),body:JSON.stringify(data)}).then(r => r.json());
export const deleteLabelSet = (id) => fetch(LBASE + '/' + id, {method:'DELETE',headers:headers()}).then(r => r.json());