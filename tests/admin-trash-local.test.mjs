import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const enabled = process.env.ADMIN_TRASH_LOCAL_TESTS === '1';
test('local trash security, soft delete/restore, holds, permanent deletion, dependency cleanup and retry protection', {skip: !enabled}, () => {
 const status=JSON.parse(execFileSync('./node_modules/.bin/supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.equal(status.API_URL,'http://127.0.0.1:54321','Only the verified local project is allowed');
 const result=execFileSync('docker',['exec','-i','supabase_db_jb-squeaky-cleaners','psql','-U','postgres','-d','postgres','-q','-v','ON_ERROR_STOP=1'],{input:fs.readFileSync('tests/admin-trash.sql','utf8'),encoding:'utf8',stdio:['pipe','pipe','pipe']});
 assert.ok(!result.includes('ERROR'),'Transaction-scoped security checks passed');
});
