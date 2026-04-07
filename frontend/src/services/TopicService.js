import { API_URL } from '../config/api';
const BASE = API_URL + '/api/topics';
const SBASE = API_URL + '/api/subtopics';
const LBASE = API_URL + '/api/labelsets';
const getToken = () => sessionStorage.getItem('token');
const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() });

const handleResponse=(r)=>{if(!r.ok)return r.json().then(function(e){var err=new Error(e.message||e.error||String.fromCharCode(82,101,113,117,101,115,116,32,102,97,105,108,101,100));err.response=e;throw err;});return r.json();};
export const getTopics = () => fetch(BASE, { headers: headers() }).then(handleResponse);
export const getTopic = (id) => fetch(BASE + '/' + id, { headers: headers() }).then(handleResponse);
export const createTopic = (data) => fetch(BASE, {method:'POST',headers:headers(),body:JSON.stringify(data)}).then(handleResponse);
export const updateTopic = (id, data) => fetch(BASE + '/' + id, {method:'PUT',headers:headers(),body:JSON.stringify(data)}).then(handleResponse);
export const deleteTopic = (id) => fetch(BASE + '/' + id, {method:'DELETE',headers:headers()}).then(handleResponse);

export const getSubtopics = (topicId) => {const url=topicId?SBASE+'?topicId='+topicId:SBASE;return fetch(url, {headers:headers()}).then(handleResponse);};
export const getSubtopic = (id) => fetch(SBASE + '/' + id, {headers:headers()}).then(handleResponse);
export const createSubtopic = (data) => fetch(SBASE, {method:'POST',headers:headers(),body:JSON.stringify(data)}).then(handleResponse);
export const updateSubtopic = (id, data) => fetch(SBASE + '/' + id, {method:'PUT',headers:headers(),body:JSON.stringify(data)}).then(handleResponse);
export const deleteSubtopic = (id) => fetch(SBASE + '/' + id, {method:'DELETE',headers:headers()}).then(handleResponse);

export const getLabelSets = (subtopicId) => {const url=subtopicId?LBASE+'?subtopicId='+subtopicId:LBASE;return fetch(url, {headers:headers()}).then(handleResponse);};
export const getLabelSet = (id) => fetch(LBASE + '/' + id, {headers:headers()}).then(handleResponse);
export const createLabelSet = (data) => fetch(LBASE, {method:'POST',headers:headers(),body:JSON.stringify(data)}).then(handleResponse);
export const updateLabelSet = (id, data) => fetch(LBASE + '/' + id, {method:'PUT',headers:headers(),body:JSON.stringify(data)}).then(handleResponse);
export const deleteLabelSet = (id) => fetch(LBASE + '/' + id, {method:'DELETE',headers:headers()}).then(handleResponse);