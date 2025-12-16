import { Application } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';

/**
 * Create a test app instance
 */
export function createTestApp(): Application {
  return createApp();
}

/**
 * Helper to make authenticated requests with API key
 */
export function authenticatedRequest(app: Application, apiKey: string = 'test-api-key') {
  return {
    get: (url: string) => request(app).get(url).set('X-API-Key', apiKey),
    post: (url: string) => request(app).post(url).set('X-API-Key', apiKey),
    put: (url: string) => request(app).put(url).set('X-API-Key', apiKey),
    patch: (url: string) => request(app).patch(url).set('X-API-Key', apiKey),
    delete: (url: string) => request(app).delete(url).set('X-API-Key', apiKey),
  };
}

/**
 * Sample todo data for testing
 */
export const sampleTodo = {
  title: 'Test Todo',
  description: 'This is a test todo item',
  priority: 'high' as const,
};

export const sampleTodoUpdate = {
  title: 'Updated Test Todo',
  completed: true,
};

/**
 * Clear the todo store between tests
 * Note: This accesses the in-memory store directly
 */
export function clearTodoStore() {
  // The store is a module-level Map, so we need to import and clear it
  const { todoStore } = require('../../src/models/todoStore');
  todoStore.clear();
}
