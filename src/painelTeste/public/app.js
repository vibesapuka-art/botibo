const dispositivos = [
  {
    id: 'samsung',
    nome: 'Samsung TV',
    imagem: 'imagens/icones/samsung.png',
    iconeFallback: '📺',
    app: 'IB Player Pro'
  },
  {
    id: 'lg',
    nome: 'LG TV',
    imagem: 'imagens/icones/lg.png',
    iconeFallback: '📺',
    app: 'IB Player Pro'
  },
  {
    id: 'androidtv',
    nome: 'Android TV',
    imagem: 'imagens/icones/androidtv.png',
    iconeFallback: '📺',
    app: 'IB Player Pro',
    desc: 'TCL, Philips, Philco, AOC, Sony, Toshiba, Xiaomi...'
  },
  {
    id: 'roku',
    nome: 'Roku TV',
    imagem: 'imagens/icones/roku.png',
    iconeFallback: '🟣',
    app: 'IB Player Pro',
    desc: 'AOC Roku, Philco Roku, TCL Roku e dispositivos Roku'
  },
  {
    id: 'firetv',
    nome: 'Fire TV',
    imagem: 'imagens/icones/firetvstick.png',
    iconeFallback: '🔥',
    app: 'IB Player Pro'
  },
  {
    id: 'tvbox',
    nome: 'TV Box',
    imagem: 'imagens/icones/tvbox.png',
    iconeFallback: '📦',
    app: 'IB Player Pro'
  },
  {
    id: 'androidmobile',
    nome: 'Android',
    imagem: 'imagens/icones/androidmobile.png',
    iconeFallback: '📱',
    app: 'IB Player'
  },
  {
    id: 'iphone',
    nome: 'iPhone',
    imagem: 'imagens/icones/ios.png',
    iconeFallback: '🍎',
    app: 'IBO Pro Player'
  }
];

let tutorialAtual = null;
let passoAtual = 0;
let regiaoAtual = 0;
let etapaFormulario = 0;
let intervaloStatus = null;

function esconderTodas() {
  document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
}

function mostrarTermos() {
  esconderTodas();
  document.getElementById('telaTermos').classList.remove('hidden');
}

function toggleBotaoTermos() {
  const check = document.getElementById('aceiteTermos');
  const btn = document.getElementById('btnAceitarTermos');

  btn.disabled = !check.checked;
}

function aceitarTermos() {
  esconderTodas();
  document.getElementById('telaBoasVindas').classList.remove('hidden');
}

function mostrarDispositivos() {
  esconderTodas();
  document.getElementById('telaDispositivos').classList.remove('hidden');
  carregarDispositivos();
}

function carregarDispositivos() {
  const lista = document.getElementById('listaDispositivos');

  lista.innerHTML = dispositivos.map(item => `
    <button class="card-dispositivo" onclick="abrirTutorial('${item.id}')">
      <img
        src="${item.imagem}"
        alt="${item.nome}"
        class="logo-dispositivo"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
      >

      <div class="icone-fallback" style="display:none;">
        ${item.iconeFallback}
      </div>

      <strong>${item.nome}</strong>

      ${item.desc ? `<span>${item.desc}</span>` : ''}

      <small>${item.app}</small>
    </button>
  `).join('');
}

async function abrirTutorial(id) {
  try {
    const resposta = await fetch(`/api/tutorial/${id}`);
    const dados = await resposta.json();

    if (!dados.success) {
      alert('Tutorial ainda não cadastrado.');
      return;
    }

    tutorialAtual = dados.tutorial;
    passoAtual = 0;

    esconderTodas();
    document.getElementById('telaTutorial').classList.remove('hidden');

    renderizarPasso();

  } catch (error) {
    alert('Erro ao carregar tutorial.');
  }
}

function montarBotaoLoja(passo) {
  if (passo.linkPlayStore) {
    return `
      <div id="botaoLojaTutorial" class="botao-loja-tutorial">
        <a href="${passo.linkPlayStore}" target="_blank" class="btn-link-loja">
          📲 ABRIR PLAY STORE
        </a>
      </div>
    `;
  }

  if (passo.linkAppStore) {
    return `
      <div id="botaoLojaTutorial" class="botao-loja-tutorial">
        <a href="${passo.linkAppStore}" target="_blank" class="btn-link-loja">
          🍎 ABRIR APP STORE
        </a>
      </div>
    `;
  }

  return '';
}

function renderizarPasso() {
  const passos = tutorialAtual.passos;
  const passo = passos[passoAtual];

  document.getElementById('tituloTutorial').innerText =
    `${tutorialAtual.icone || ''} ${tutorialAtual.dispositivo}`;

  document.getElementById('appTutorial').innerText =
    `Aplicativo: ${tutorialAtual.app}`;

  document.getElementById('tituloPasso').innerText =
    `${passo.titulo} (${passoAtual + 1} de ${passos.length})`;

  document.getElementById('textoPasso').innerHTML = passo.texto || '';

  const img = document.getElementById('imagemPasso');

  if (passo.imagem) {
    img.src = passo.imagem;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
    img.removeAttribute('src');
  }

  const botaoExistente = document.getElementById('botaoLojaTutorial');

  if (botaoExistente) {
    botaoExistente.remove();
  }

  const htmlBotao = montarBotaoLoja(passo);

  if (htmlBotao) {
    img.insertAdjacentHTML('afterend', htmlBotao);
  }

  const porcentagem = ((passoAtual + 1) / passos.length) * 100;
  document.getElementById('barraProgresso').style.width = `${porcentagem}%`;

  const btnNaoEncontrei = document.getElementById('btnNaoEncontrei');

  if (passo.mostrarNaoEncontrei) {
    btnNaoEncontrei.classList.remove('hidden');
  } else {
    btnNaoEncontrei.classList.add('hidden');
  }

  const btnProximo = document.getElementById('btnProximo');

  if (passoAtual === passos.length - 1) {
    btnProximo.innerText = '✅ Já instalei';
  } else {
    btnProximo.innerText = 'Próximo →';
  }
}

function proximoPasso() {
  if (passoAtual < tutorialAtual.passos.length - 1) {
    passoAtual++;
    renderizarPasso();
  } else {
    mostrarFormulario();
  }
}

function passoAnterior() {
  if (passoAtual > 0) {
    passoAtual--;
    renderizarPasso();
  }
}

function abrirRegiao() {
  regiaoAtual = 0;
  esconderTodas();
  document.getElementById('telaRegiao').classList.remove('hidden');
  renderizarRegiao();
}

function renderizarRegiao() {
  const passos = tutorialAtual.regiaoPassos || [];
  const img = document.getElementById('imagemRegiao');

  if (!passos.length) {
    document.getElementById('tituloRegiao').innerText = 'Ajuda';
    document.getElementById('textoRegiao').innerHTML = `
      Caso não encontre o aplicativo, entre em contato com nosso suporte.
      <br><br>
      <a href="https://wa.me/5544988214771" target="_blank" class="btn-link-loja">
        💬 FALAR COM SUPORTE
      </a>
    `;

    img.classList.add('hidden');
    document.getElementById('barraRegiao').style.width = '100%';
    return;
  }

  const passo = passos[regiaoAtual];

  document.getElementById('tituloRegiao').innerText =
    `${passo.titulo} (${regiaoAtual + 1} de ${passos.length})`;

  document.getElementById('textoRegiao').innerText = passo.texto || '';

  if (passo.imagem) {
    img.src = passo.imagem;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
    img.removeAttribute('src');
  }

  const porcentagem = ((regiaoAtual + 1) / passos.length) * 100;
  document.getElementById('barraRegiao').style.width = `${porcentagem}%`;
}

function proximaRegiao() {
  const passos = tutorialAtual.regiaoPassos || [];

  if (regiaoAtual < passos.length - 1) {
    regiaoAtual++;
    renderizarRegiao();
  } else {
    voltarTutorial();
  }
}

function regiaoAnterior() {
  if (regiaoAtual > 0) {
    regiaoAtual--;
    renderizarRegiao();
  }
}

function mostrarFormulario() {
  esconderTodas();

  etapaFormulario = 0;

  document.getElementById('resultado').innerHTML = '';
  document.getElementById('telaFormulario').classList.remove('hidden');

  renderizarEtapaFormulario();
}

function renderizarEtapaFormulario() {
  const etapas = [
    'etapaMac',
    'etapaKey',
    'etapaNome',
    'etapaWhatsapp',
    'etapaTipoTeste',
    'etapaConfirmacao'
  ];

  etapas.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  document.getElementById(etapas[etapaFormulario]).classList.remove('hidden');

  const porcentagem = ((etapaFormulario + 1) / etapas.length) * 100;
  document.getElementById('barraFormulario').style.width = `${porcentagem}%`;

  const btn = document.getElementById('btnAvancarFormulario');

  if (etapaFormulario === etapas.length - 1) {
    btn.innerText = '✅ Confirmar e ativar teste';
    atualizarResumo();
  } else {
    btn.innerText = 'Próximo →';
  }
}

function selecionarTipoTeste(tipo) {
  document.getElementById('tipoTeste').value = tipo;

  const btnSemAdulto = document.getElementById('btnSemAdulto');
  const btnComAdulto = document.getElementById('btnComAdulto');

  btnSemAdulto.classList.remove('ativo');
  btnComAdulto.classList.remove('ativo');

  if (tipo === 'sem_adulto') {
    btnSemAdulto.classList.add('ativo');
  } else {
    btnComAdulto.classList.add('ativo');
  }
}

function avancarEtapaFormulario() {
  const mac = document.getElementById('mac').value.trim();
  const key = document.getElementById('key').value.trim();
  const nomeCliente = document.getElementById('nomeCliente').value.trim();
  const whatsapp = document.getElementById('whatsapp').value.trim();

  if (etapaFormulario === 0 && !mac) {
    alert('Informe o MAC do dispositivo.');
    return;
  }

  if (etapaFormulario === 1 && !key) {
    alert('Informe a KEY do dispositivo.');
    return;
  }

  if (etapaFormulario === 2 && !nomeCliente) {
    alert('Informe seu nome.');
    return;
  }

  if (etapaFormulario === 3 && !whatsapp) {
    alert('Informe seu WhatsApp.');
    return;
  }

  if (etapaFormulario < 5) {
    etapaFormulario++;
    renderizarEtapaFormulario();
  } else {
    enviarTeste();
  }
}

function voltarEtapaFormulario() {
  if (etapaFormulario > 0) {
    etapaFormulario--;
    renderizarEtapaFormulario();
  } else {
    voltarTutorial();
  }
}

function atualizarResumo() {
  const tipo = document.getElementById('tipoTeste').value;

  document.getElementById('resumoMac').innerText =
    document.getElementById('mac').value.trim();

  document.getElementById('resumoKey').innerText =
    document.getElementById('key').value.trim();

  document.getElementById('resumoNome').innerText =
    document.getElementById('nomeCliente').value.trim();

  document.getElementById('resumoWhatsapp').innerText =
    document.getElementById('whatsapp').value.trim();

  document.getElementById('resumoTipoTeste').innerText =
    tipo === 'com_adulto' ? 'Com Adulto 🔞' : 'Sem Adulto';
}

async function enviarTeste() {
  esconderTodas();

  document.getElementById('telaProcessando').classList.remove('hidden');
  document.getElementById('blocoSuporte').classList.add('hidden');

  document.getElementById('tituloProcesso').innerText = 'Gerando teste...';
  document.getElementById('mensagemProcesso').innerText = 'Estamos criando seu acesso. Aguarde.';
  document.getElementById('barraProcesso').style.width = '20%';
  document.getElementById('percentualProcesso').innerText = '20%';

  atualizarChecklistProcesso({});

  const nomeCliente = document.getElementById('nomeCliente').value.trim();
  const whatsapp = document.getElementById('whatsapp').value.trim();
  const mac = document.getElementById('mac').value.trim();
  const key = document.getElementById('key').value.trim();
  const tipoTeste = document.getElementById('tipoTeste').value;

  try {
    const resposta = await fetch('/api/teste', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nomeCliente,
        whatsapp,
        mac,
        key,
        tipoTeste
      })
    });

    const dados = await resposta.json();

    if (!dados.success) {
      document.getElementById('tituloProcesso').innerText = 'Atenção';
      document.getElementById('mensagemProcesso').innerText = dados.mensagem;
      document.getElementById('barraProcesso').style.width = '100%';
      document.getElementById('percentualProcesso').innerText = '100%';
      document.getElementById('blocoSuporte').classList.remove('hidden');
      return;
    }

    document.getElementById('tituloProcesso').innerText = 'Teste gerado!';
    document.getElementById('mensagemProcesso').innerText = 'Agora estamos configurando seu IB Player.';
    document.getElementById('barraProcesso').style.width = '35%';
    document.getElementById('percentualProcesso').innerText = '35%';

    atualizarChecklistProcesso({
      teste: true
    });

    if (dados.jobId) {
      acompanharStatus(dados.jobId);
    }

  } catch {
    document.getElementById('tituloProcesso').innerText = 'Erro';
    document.getElementById('mensagemProcesso').innerText = 'Erro ao ativar teste. Tente novamente.';
    document.getElementById('barraProcesso').style.width = '100%';
    document.getElementById('percentualProcesso').innerText = '100%';
    document.getElementById('blocoSuporte').classList.remove('hidden');
  }
}

function acompanharStatus(jobId) {
  if (intervaloStatus) {
    clearInterval(intervaloStatus);
  }

  intervaloStatus = setInterval(async () => {
    try {
      const resposta = await fetch(`/api/teste/status/${jobId}`);
      const dados = await resposta.json();

      if (!dados.success) {
        return;
      }

      const progresso = dados.progresso || 0;

      document.getElementById('tituloProcesso').innerText =
        dados.titulo || 'Configurando...';

      document.getElementById('mensagemProcesso').innerText =
        dados.mensagem || 'Aguarde...';

      document.getElementById('barraProcesso').style.width =
        `${progresso}%`;

      document.getElementById('percentualProcesso').innerText =
        `${progresso}%`;

      atualizarChecklistProcesso(dados.checklist || {});

      if (dados.status === 'finalizado' || dados.status === 'erro') {
        clearInterval(intervaloStatus);
        document.getElementById('blocoSuporte').classList.remove('hidden');
      }

    } catch {
      console.log('Aguardando status...');
    }
  }, 2000);
}

function atualizarChecklistProcesso(checklist) {
  document.getElementById('checkTeste').innerText =
    checklist.teste ? '✅ Teste criado' : '⬜ Teste criado';

  document.getElementById('checkAcesso').innerText =
    checklist.acesso ? '✅ Acessando IB Player' : '⬜ Acessando IB Player';

  document.getElementById('checkValidacao').innerText =
    checklist.validacao ? '✅ Validando MAC e KEY' : '⬜ Validando MAC e KEY';

  document.getElementById('checkPlaylist1').innerText =
    checklist.playlist1 ? '✅ Playlist 1 adicionada' : '⬜ Playlist 1 adicionada';

  document.getElementById('checkPlaylist2').innerText =
    checklist.playlist2 ? '✅ Playlist 2 adicionada' : '⬜ Playlist 2 adicionada';

  document.getElementById('checkPlaylist3').innerText =
    checklist.playlist3 ? '✅ Playlist 3 adicionada' : '⬜ Playlist 3 adicionada';

  document.getElementById('checkPlaylist4').innerText =
    checklist.playlist4 ? '✅ Playlist 4 adicionada' : '⬜ Playlist 4 adicionada';

  document.getElementById('checkPlaylist5').innerText =
    checklist.playlist5 ? '✅ Playlist 5 adicionada' : '⬜ Playlist 5 adicionada';

  document.getElementById('checkFinalizado').innerText =
    checklist.finalizado ? '✅ Finalizando configuração' : '⬜ Finalizando configuração';
}

function voltarDispositivos() {
  mostrarDispositivos();
}

function voltarTutorial() {
  esconderTodas();

  document.getElementById('telaTutorial').classList.remove('hidden');

  renderizarPasso();
}
