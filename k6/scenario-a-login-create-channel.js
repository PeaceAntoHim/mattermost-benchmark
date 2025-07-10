import http from 'k6/http';
import { sleep, check } from 'k6';

export let options = {
    vus: 50,
    duration: '3m',
};

export default function () {
    const url = 'http://localhost:8065/api/v4/users/login';
    const payload = JSON.stringify({
        login_id: 'test@example.com',
        password: 'Password123!',
    });

    const headers = { 'Content-Type': 'application/json' };

    let res = http.post(url, payload, { headers });

    check(res, {
        'login success': (r) => r.status === 200,
    });

    sleep(1);
}
