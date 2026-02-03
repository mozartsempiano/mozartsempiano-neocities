---
layout: default
title: guizin_botson
---

**guizin_botson** é um bot para [Twitter](https://twitter.com/guizin_botson) e [Bluesky](https://bsky.app/guizin_botson.bsky.social), [programado](/programacao/) por [mim](/), que relembra tweets do [guizin Ohh +Brabo!!](https://web.archive.org/web/20210311044740/twitter.com/guizin_jeferson) (@guizin_jeferson), que desativou permanentemente sua conta na primeira metade de 2021.

Ler os tweets do Guizin era algo que sempre me fazia sorrir, por serem tão honestos e otimistas, apesar de ele ser só um personagem.

É totalmente compreensível ele ter parado de tweetar, pela justificativa de que reconhece "quando algo chega ao fim", mas não acredito que erradicar a conta da existência tenha sido uma decisão de interesse coletivo ou pelo bem comum, quando poderia só ter a largado intacta. Na época, fiquei triste com isso, porque adorava, em momentos específicos, pesquisar por tweets antigos na conta e dar retweet pra relembrá-los, que era algo, que, na verdade, muita gente constantemente fazia. Foi como a destruição da Biblioteca de Alexandria.

Com isso, acabei tendo a ideia de arquivar diversos tweets perdidos dele, encontrados em screenshots e no [Wayback Machine](https://web.archive.org/web/*/twitter.com/guizin_jeferson*), e salvá-los num arquivo, inicialmente, .txt. Acabei indo além e criando um bot em Python que escolheria um tweet aletório nesse arquivo de texto e postaria no Twitter a cada X minutos.

Inicialmente, era um script extremamente arcaico e mal organizado, porque não tinha tanta experiência em Python, mas pelo menos funcionava. Com o tempo, a conta foi sendo descoberta pelas pessoas, e fui otimizando o código, adicionando, inclusive, uma série de verificações de período do dia, mês atual, ano, entre outros, pra contextualizar melhor alguns dos tweets que mencionavam alguns deles. Por exemplo, agora, um tweet que mencionava "bom dia" nunca seria postado no período da tarde ou noite, ou um que menciona "agosto" só seria postado em agosto. Além disso, fiz com que um tweet que menciona o ano atual, sempre atualize o ano em questão, para que ele permaneça relevante.
