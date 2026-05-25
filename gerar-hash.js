const bcryptjs = require('bcryptjs');

const senha = 'admin123';
const hash = bcryptjs.hashSync(senha, 10);

console.log('\n' + '='.repeat(60));
console.log('GERADOR DE HASH DE SENHA');
console.log('='.repeat(60));
console.log(`\nSenha: ${senha}`);
console.log(`Hash: ${hash}`);
console.log('\nCopie este hash e execute no MySQL Workbench:');
console.log(`\nDELETE FROM usuarios;`);
console.log(`INSERT INTO usuarios (usuario, senha) VALUES ('admin', '${hash}');\n`);
console.log('='.repeat(60) + '\n');