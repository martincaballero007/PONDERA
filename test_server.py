import unittest
import json
from app import app

class PonderaAppTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    def test_index_route(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Pondera', response.data)
        print("PASS: Index route GET /")

    def test_initial_data_route_is_empty(self):
        response = self.client.get('/api/initial-data')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data.get('is_empty'))
        self.assertEqual(len(data['periods']), 0)
        print("PASS: Initial data API is empty by default per user requirement")

if __name__ == '__main__':
    unittest.main()
