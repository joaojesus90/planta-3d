# Planta 3D

Simulador simples de divisões: indicas as medidas, as portas e as janelas, escolhes o estilo e vês o resultado em planta e em 3D, divisão a divisão ou a casa inteira.

## O que faz

- **Assistente de nova divisão**: tipo (casa de banho, quarto, sala, cozinha, escritório ou vazia), medidas, portas, janelas e estilo.
- **Portas** em qualquer parede, com a distância a cada uma das paredes laterais (a segunda calcula-se sozinha). Tipos: batente (para dentro ou para fora, com o lado da dobradiça), de correr embutida, de correr à vista ou só vão.
- **Janelas** com largura, altura e altura do peitoril.
- **Mobiliário automático** para cada tipo de divisão, que respeita a passagem das portas, as janelas e a caixa das portas de correr. Depois podes arrastar, rodar, espelhar, redimensionar, remover ou acrescentar peças.
- **8 estilos**: Mármore Calacatta e dourado, Mármore Nero e dourado, Microcimento, Escandinavo, Japandi, Zellige verde e latão, Mediterrâneo português e Industrial. Um estilo por divisão.
- **Casa inteira**: arrasta as divisões na planta para as encaixar (as paredes alinham sozinhas) ou escreve a posição em metros.
- **Partilhar**: o menu ☰ gera um link com o projeto completo lá dentro. Também podes descarregar ou abrir um ficheiro `.json`.
- O projeto fica guardado automaticamente no browser.

## Convenções

- Medidas interiores, em metros, de parede a parede.
- Na planta, a parede **A** é a de cima, **B** a da direita, **C** a de baixo e **D** a da esquerda.
- As texturas e cores são aproximadas. Confirma sempre com amostras reais e valida as medidas em obra.

## Publicar no GitHub Pages

1. Cria um repositório e envia estes ficheiros para a raiz (o `index.html` tem de ficar na raiz).
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, escolhe `main` e a pasta `/ (root)`.
3. Passado um minuto, o site fica em `https://<utilizador>.github.io/<repositório>/`.

Não precisa de compilação nem de servidor: são ficheiros estáticos. O 3D usa o [three.js](https://threejs.org) carregado do jsDelivr.

## Correr localmente

Os módulos JavaScript não funcionam abrindo o ficheiro diretamente, por isso usa um servidor simples:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Estrutura

```
index.html          página e layout
css/style.css       estilos (mobile primeiro)
js/main.js          estado da app, painéis, assistente, guardar e partilhar
js/model.js         dados, catálogo de móveis, estilos e distribuição automática
js/plan.js          planta 2D em SVG (arrastar divisões e móveis)
js/scene3d.js       vista 3D (paredes, portas, janelas, luz, câmara)
js/furniture3d.js   modelos 3D dos móveis
js/textures.js      texturas geradas por código (mármore, madeira, azulejo…)
```
