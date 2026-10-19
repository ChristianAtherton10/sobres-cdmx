# Cruce de candidatos contra el catálogo de SOBRES

Generado el 18 de octubre de 2026 a partir de `SOBRES_candidatos.json` (679 registros, todos con `active: false`) contra las **1125 fichas** que hoy usa la app (catálogo base, correcciones y altas de la capa de auditoría, sin bajas ni perfiles de ejemplo).

El detalle de cada registro está en `reportes/candidatos-cruce.json` y el script en `reportes/cruce_candidatos.py`. Volver a correrlo con la misma lista no duplica fichas ni cambia IDs: sólo lee.

## Resultado

| Estado | Cuántos | Qué significa |
|---|---:|---|
| existente | 131 | Ya está en el catálogo con el mismo nombre (o la misma sucursal). |
| existente varias sucursales | 2 | La marca está con varias sucursales y el candidato no dice cuál. |
| marca existente sucursal nueva | 29 | La marca existe, pero esa sucursal no. Hace falta dirección para darla de alta. |
| posible duplicado | 39 | Se parece a una ficha existente. Es tarea de revisión, no permiso para fusionar. |
| fuera de cdmx por resolver | 14 | Todas sus fuentes lo ubican en la zona metropolitana (Satélite, Naucalpan…). |
| nuevo sin confirmar | 463 | No aparece en el catálogo. Falta toda la ficha operativa. |
| corregido en catalogo | 1 | Corrección del fundador aplicada a una ficha que ya existía. |
| **Total** | **679** | |

## Por qué no se activó ningún candidato

La guía pide activar sólo fichas suficientemente completas. **Ninguno de los 679 trae dirección, coordenadas, horario ni precio** (todos los campos operativos vienen en `null`). Un nombre en una lista editorial sirve para descubrir un lugar, pero no confirma que esté abierto, dónde está ni cuánto cuesta. Por eso:

- **0 candidatos activados.** Nada de esta lista entra a la generación de planes.
- La app **no dice** "500 lugares nuevos": son 463 nombres por investigar.
- La única excepción es **Casa San Juan**, que ya existía como ficha y se corrigió (ver abajo).

## Casa San Juan

Antes: "Casa San Juan · Lomas", Restaurante en Av. Prado Norte, $750, 13:00–23:00, sin fuente.

Ahora: **Antro en Polanco III Secc, Av. Presidente Masaryk 393**, coordenadas 19.432158, −99.1981266. Dos fuentes independientes coinciden: la ficha de [CDMX Reservas](https://cdmxreservas.com/casa-san-juan-masaryk/) (club nocturno de reggaetón y pop comercial, dress code casual elegante) y [Mango Mango](https://mangomango.mx/) (pin de Google Maps). **Ninguna publica horario, días ni cover**, así que la ficha queda con precio y horario *por confirmar*; para poder acomodarla en una noche usa la ventana típica de antro, marcada como estimada, y la app no ofrece horas para apartar.

Se comprobó en buscador, mapa y generación de planes (prueba "Casa San Juan es un antro en Polanco…" en `test/motor.test.js`).

## Sucursales nuevas de marcas que ya están (29)

- Bistro Estoril - Santa Fe — hoy hay: Bistro Estoril
- Cancino - Coyoacán — hoy hay: Cancino · Roma
- Cancino - Havre — hoy hay: Cancino · Roma
- Cancino - Nápoles — hoy hay: Cancino · Roma
- Cancino - Polanco — hoy hay: Cancino · Roma
- Casa O - Lomas — hoy hay: Casa Ó · Arcos Bosques
- Casa O - San Angel — hoy hay: Casa Ó · Arcos Bosques
- Gin Gin - Cibeles — hoy hay: Gin Gin · Polanco
- Gin Gin - Condesa — hoy hay: Gin Gin · Polanco
- Gin Gin - Álvaro Obregón — hoy hay: Gin Gin · Polanco
- Hunan - Artz — hoy hay: Hunan · Polanco
- Hunan - Reforma — hoy hay: Hunan · Polanco
- La Popular - Arcos Bosques — hoy hay: La Popular · Polanco
- Mandolina - Roma — hoy hay: Mandolina · Polanco
- Mattea - Santa Fe — hoy hay: Mattea · Polanco
- Mochomos - Arcos Bosques — hoy hay: Mochomos · Santa Fe
- Mochomos - Mitikah — hoy hay: Mochomos · Santa Fe
- Negroni - Mitikah — hoy hay: Negroni · Arcos Bosques, Negroni · Condesa, Negroni · Artz
- Nobu - Arcos Bosques — hoy hay: Nobu · Polanco
- Puerto Madero - Mitikah — hoy hay: Puerto Madero · Arcos Bosques
- Puerto Madero - San Angel — hoy hay: Puerto Madero · Arcos Bosques
- Quattro - JW Marriott Sta Fe — hoy hay: Quattro
- Ryoshi - Masaryk — hoy hay: Ryoshi
- Saks - Polanco — hoy hay: Saks · San Ángel
- Sonora Grill - Narvarte — hoy hay: Sonora Grill · Antara, Sonora Grill · Mitikah, Sonora Grill · Miyana
- Sonora Grill - Reforma — hoy hay: Sonora Grill · Antara, Sonora Grill · Mitikah, Sonora Grill · Miyana
- Sonora Grill - Roma — hoy hay: Sonora Grill · Antara, Sonora Grill · Mitikah, Sonora Grill · Miyana
- Sylvestre - Santa Fe — hoy hay: Sylvestre
- Tacos Paris - CDMX — hoy hay: Tacos París

## Marca con varias sucursales, sin decir cuál (2)

- El Bajío — El Bajío · Polanco, El Bajío · Santa Fe
- La Casa de Toño — La Casa de Toño · Zona Rosa, La Casa de Toño · Mitikah

## Posibles duplicados para revisar a mano (39)

- Butcher and Sons Polanco — ¿es Butcher & Sons · Roma (0.50)?
- Casa Estudio de Diego Rivera y Frida Kahlo — ¿es Museo Casa Estudio Diego Rivera y Frida Kahlo (1.00) / Centro de Documentación del Museo Casa Estudio Diego Rivera y Frida Kahlo (0.71) / Museo Frida Kahlo (0.40)?
- Casa Prime Santa Fe — ¿es Sonora Grill Prime · Santa Fe (0.60)?
- Centro Cultural de España (México) — ¿es Centro Cultural de España en México (0.75) / Espacio X del Centro Cultural de España en México (0.60)?
- Centro Cultural Universitario Tlatelolco — ¿es Centro Cultural Universitario Tlatelolco (CCUT) (0.80) / Centro Cultural Museo Universitario del Chopo (0.60) / Ágora del Centro Universitario Cultural (0.60)?
- Centro de Cultura Ambiental Chapultepec — ¿es Centro de Cultura Ambiental (0.75)?
- Centro de la Imagen — ¿es Museo Centro de la Imagen (1.00) / Biblioteca del Centro de la Imagen (0.67)?
- Chilakillers Santa María la Ribera — ¿es Alameda de Santa María la Ribera (0.60) / Casa de Cultura Santa María la Ribera (0.60)?
- Cineteca Nacional Chapultepec — ¿es Cineteca Nacional (0.67)?
- Cineteca Nacional de las Artes — ¿es Cineteca Nacional (0.67)?
- Cineteca Nacional Xoco — ¿es Cineteca Nacional (0.67)?
- El Balcon del Zocalo — ¿es Balcón del Zócalo (1.00)?
- El Japonez - Oasis Coyoacán — ¿es Oasis Coyoacán (0.67)?
- El Moro Santa María la Ribera — ¿es Alameda de Santa María la Ribera (0.60) / Casa de Cultura Santa María la Ribera (0.60)?
- Enigma Rooms Roma — ¿es Enigma Rooms Roma I (1.00) / Enigma Rooms Roma II (0.75)?
- Farina San Ángel — ¿es Restaurante San Ángel (0.67)?
- Fiesole - San Angel — ¿es Restaurante San Ángel (0.67)?
- Guadiana - San Angel — ¿es Restaurante San Ángel (0.67)?
- Jardín Botánico del Bosque de Chapultepec — ¿es Jardín Botánico de Chapultepec (0.75) / Bosque de Chapultepec (0.50)?
- La Mallorquina Arcos — ¿es La Mallorquina · Arcos Bosques (0.67)?
- La Sede — ¿es Sede Café (1.00)?
- Laboratorio Arte Alameda — ¿es Laboratorio Arte Alameda (LAA) (0.75)?
- Lago de Chapultepec, paseo en lancha — ¿es Lago de Chapultepec (0.40)?
- Mesón Taurino San Angel — ¿es Restaurante San Ángel (0.50)?
- Munal. Museo Nacional de Arte — ¿es Biblioteca del Museo Nacional de Arte (MUNAL) (0.75) / Museo Nacional de Arte (MUNAL) (Cierre temporal) (0.60)?
- Museo Antiguo Colegio de San Ildefonso — ¿es Antiguo Colegio de San Ildefonso (1.00)?
- Museo de Arte Carrillo Gil — ¿es Museo de Arte Alvar y Carmen T. de Carrillo Gil (0.60)?
- Museo de Arte Moderno — ¿es Museo de Arte Moderno (MAM) (0.67) / Biblioteca del Museo de Arte Moderno (0.67)?
- Museo de Arte Popular (MAP) — ¿es Museo de Arte Popular (0.67)?
- Museo Ex Teresa Arte Actual — ¿es Ex Teresa Arte Actual (EXTAA) (0.80) / Centro de Documentación del Museo Ex Teresa Arte Actual (0.67)?
- Museo Nacional de Historia — ¿es Biblioteca del Museo Nacional de Historia (0.67)?
- Museo Soumaya Casa Guillermo Tovar de Teresa — ¿es Casa Museo Guillermo Tovar de Teresa (Fundación Soumaya) (0.80)?
- Museo Tamayo Arte Contemporáneo — ¿es Museo de Arte Contemporáneo Internacional Rufino Tamayo (0.60)?
- Onomura - Parque Hundido — ¿es Parque Hundido (0.67)?
- Pan Comido Anzures — ¿es Pan Comido (0.67)?
- Parque Frida Kahlo — ¿es Museo Frida Kahlo (0.67)?
- Parque Luis G. Urbina (Parque Hundido) — ¿es Parque Hundido (0.50)?
- Tagers CDMX- San Ángel — ¿es Restaurante San Ángel (0.67)?
- Zeru - San Ángel — ¿es Restaurante San Ángel (0.67)?

## Fuera de la CDMX según sus fuentes (14)

- Antolina
- Cantina La No. 20 - Satélite
- Carajillo Satelite
- Encanto Fuego y Mar
- Gin Gin - Plaza Satélite
- Guadiana - Satelite
- La Mansion - Satelite
- Los Culiado's Mariscos - Satelite
- Prosecco - Satelite
- Puerto Madero - Satelite
- Saks -Barranca
- Sal e Brasa Satelite
- Sonora Grill - Mundo E
- TRAMPA

## Nuevos sin confirmar (463), por categoría sugerida

Para priorizar la investigación. La categoría es la orientativa de la lista, no una clasificación verificada.

**Restaurante (clasificar servicio) (342):** 1985 Antifine, Aida, AITANA, AjoBlanco, Al Andalus - San Angel, Alaia, Alboroto, Alegra, Aleli Rooftop, Alesia, Alfredo Di Roma - Polanco, Altanera, Amici-Sheraton Maria Isabel, Amore Mio Trattoria, Animal - Masaryk, ANIMAL - ST REGIS, ANONIMO COLECTIVO, Arango, Aroma Curry, Asador 51 cocina de brasas, Asian Bay, Au Pied de Cochon - Polanco, Azul maguey, Bajel, Bakea, Baldio, Balkan Grill, Balta, Barrio Norte, Barrio Satélite, Bartola, Bella Aurora, Bellaria - Mexico, Belmondo, Bistro 83 - San Angel, Bistró Arlequín, Biwon, Blossom - Del Valle, Blossom - Palmas, Blossom- Santa Fe, Bodega de los Malazzo, BOTANICO, Botica, Boul Cocina Latina, BRAVA, Bribón, Bulla - CDMX (Condesa), Burger Gang, Camaron Buchon - Coyoacan, Cambalache - Insurgentes, Cambalache - Oasis, Cambalache - Polanco, Camino a Comala Santa María la Ribera, Campobaja, CANA, Cantinetta del Becco, Caracol de Mar, Carolo - Santa Fe, Casa Manzano Ciudad de Mexico, Casa Nagi, Casa Portuguesa, Casa Prime Hilton Centro Histórico, Casa Prime Masaryk, Casa Virginia Mónica Patiño, Cascabel, Cascabel Tostado, Castizo, Central Central, Cerrajería, Chalino Chino, Chambao Polanco, Chetito, Chilakillers Loungeria, CIENA, Cobarde, Cochinita Power, Comal de Piedra, Comal Oculto, Comixcal, Conchita Clamont, Cortile, Crisis, Cuerno - Masaryk, Daikoku - Michoacan, Dans le Noir ? - Cena a oscuras, Decrab - Prado Norte, Deigo Cocina Tradicional Japonesa, Domingo Santo, Dragon House Zhu, El Faraón, El Jamil, El Japonez - Manacar, El Japonez - Santa Fe, El Mundo, El Naranjito, El Rey del Suadero, El Tigre Silencioso, Elly's, Eloise Chic Bistrot, Emilio, Emília, Enrico Caruso, ENZU RESTAURANTE Y BAR, Esca, Escondida Parrilla, Esquina Común, Estoril, Fabia, Fiamma, Filigrana, Fogo de Chão - Mexico City - Insurgentes, Fogo de Chão - Mexico City - Mitikah, Fogo de Chão - Mexico City - Perisur, Fogo de Chão - Mexico City - Polanco, Forever Vegano, FORM + MATTER (FOMA), Fritanguita, Fugaz, Futari, Gaba, Galea, Garum, Gatorta, Gauchinho, Gaudí - Hotel Imperial Reforma, Gino's - Galerías Insurgentes, Giorella, Goguinara, Grasso, Guzina Oaxaca, Happy Lamb Hot Pot, Helus, Hong King, Hostería de Santo Domingo, Hotaru - Arcos, Hotaru - Lomas, Hotaru - Mitikah, IDE Gourmet Oriental, IL PUNTO, In Mano Roma, ISMO, Itacate del Mar, Ivoire, Jametaro, Jowong, Ka Won Seng, Kale+, Kill Bill, Ko Ma, Koku, Kolobok, L' Entrecote Polanco, L' Osteria del Becco, L'Enfant, La Barra de Fran, La Belle Epoque, La Bellezza, La Buena Barra - Polanco, La Buenavida Fonda, La Cabaña de Fuentes, La Casa de las Sirenas, La Casserole, La Chalupería, La Distral - CDMX, La Gloriosa, La Guerrerense, La Lanterna, La Mansion - Insurgentes, La Mansión - Palmas, La Once Mil, La Pagoda, La Poblanita de Tacubaya Patriotismo, La Posta, La Provoleta - Rhin, La Rural Argentina, Lampuga Polanco, Las Nazarenas, Lavo, Lazy Susan, Le Lah Tho, Le Petit Resto, Les Moustaches, Lindy, Ling Ling Mexico, Loma Linda - Carso, Loma Linda - Santa Fe, Loose Blues Dining, Lorea, Lorenzo, Loretta Chic Bistrot, Los Arbolitos, Los Arcos - Insurgentes, Los Arcos - San Jeronimo, Los Canarios - Insurgentes, Los Canarios - Marquis Reforma, Los Canarios - Santa Fe, Los Loosers, Los Pericos, Lotti, Ludlow Perisur, Madeo, Magda, Maizajo, Malix, Mallorca - Lomas, MalPortaco, Marisquería Julichi, Marmota, Marta, María Ciento38, María Trinidad, Meson Puerto Chico, Mexa Cocina del Alma, Midam, Migrante, Mikasa, Miru, MO+F, Mojama, Momiji, MONGO, Morton's The Steakhouse - Mexico City, Murakami, Mux Restaurante, Mythos Cibeles, Mythos Estiatorio, Máximo, Nadefo, Nativo Taller Gastronómico Polanco, Naufragante Restaurante, Nibelungengarten, Nostos - Lomas de Chapultepec, Nusr-Et Steakhouse Mexico City, O'Mandu, Onomura - Prado Norte, Onomura - Santa Fe, Ostería 8, OTTO, OXA Cocina Unica, Pakaá, Palominos - Insurgentes, Palominos - Palmas, Pargot, Parla, Pasillo de Humo, Pasta Comedia - Polanco, Patio 81 Bistro, Paxia, Pelota Mestiza, PETIT HUNAN, Pigeon, Pinky Room, Pistilo, Plantasia, Plonk, Porfirio's Coyoacán, Prendes Moliere, Prime Steak Club – Ángel De La Independencia, Pronti, Prosecco - Polanco, Prosecco - Santa Fe, Puerto Prendes - Durango, Qü-Qoo Kitchen Bar, Ramona, Restaurante L' Ostia, Restaurante Mistral, Restaurante Tehuacan, Rincon Argentino - Santa Fe, Roca - Lomas, ROJO ROMA, Rokai, Sakai, SAL E BRASA - REFORMA, Sal E Brasa Del Valle, SAMOS - The Ritz Carlton México City, Santino condesa, Santino Polanco, Santo Hand Roll Bar, Santo Spirito, Savvia, Sente, Sept Cinq 75 Francia, Sesame, Señora Tanaka - Masaryk, Shu - Santa Fe, Siembra terraza, Simonetta Bistró, Sonia, Soul la Roma, SUKAI, Suntory - Pedregal, Suntory Lomas, SUVAI, Séptimo Osteria, Sōōp, Taco Tasting Room, Talavera Bistro, Tandoor - Condesa, Taro, Taverna, Terraza Rocco Zocalo, TESTAL - Centro Histórico, TESTAL - Roma, Tezontle, THE HUB, The Palm Restaurant - Polanco, TIGRE -MASARYK, TK Terraza Grill, TONCHIN CDMX, Tori Tori - Izakaya, Torino - Santa Fe, Tortas al Fuego, Tostados, Trastevere, Trattoria Grata, Trillo, Ultramarinos de Fran (Perisur), Umbral, Vacaciones, Varde, Vecchio Forno - Centro Histórico, Vegamo, VERA, Versalles 19, Viamonte, Vicinato, Vigneron, Viñetta, Wagyu Jyube, WANWAN Sakaba, Warung Makan, Welik, Wok This Way, Xuna, Xuva’, Yakumanka by Gaston Acurio - Roma, Yoshimi- Hyatt Regency Mexico City, Zagala, Zeru - Lomas, Étranger, Órale Arepa, Ödün

**Café, postre o concepto mixto (21):** 220 Panadería, Abarrotes Delirio, Amati Deli, Café Budapest Cukraszda, Café Margarita, Chico’s Cafe, Común Cafe & Vino, Crispy Cereal Bar, El Ocho Café Reactivo, Hard Rock Cafe México City WTC, Hello Kitty Café Cibeles, La Especial de París, Le Pain Quotidien, Ludlow Bistró & Café - Mitikah, Madre Café, Mantequilla Social Club, Marne Café, Passmar, Ritmo Café, Territorio R Café Taller, White Willow Café

**Bar / concepto nocturno (14):** 10&9 Rooftop and Cocktail Bar, Bar Amici, Bar latosa, Cabuya Rooftop, El 98, Hoppy House, Hugo, KATZ Cocktail Bar, Miah Bar, Monolito, Nota Tavern, Pandora Rooftop, pujol.itto, Rosso Speakeasy

**Heladería (13):** Casa Morgana Heladería, Cold Beat, Don Nino, Glaciar: Libros Helados, Helado Bonito, Helados Amor Casero, Joe Gelato, Monk'Ice, Nevería El Kiosco de Coyoacán, Nieve de Olla, Nómada Heladería, Roxy, Sweet Monster

**Parque / área verde (12):** Parque Alameda Nápoles, Parque canino del Jardín Alexander Pushkin, Parque Circular Morelia, Parque Cuitláhuac, Parque de los Dinamos, Parque de Pilares, Parque Ecológico de Xochimilco, Parque Ejidal San Nicolás Totolapan, Parque La Tapatía, Parque Naucalli, Parque Rufino Tamayo, Parque Tezozómoc

**Taquería / comida (10):** Por Siempre Vegana Taquería, Tacos El Caminero, Tacos La Salsa, Tacos Orinoco, Taquería Gabriel, Taquería La Onda, Taquería La Roma, Taquería Los Amigos, Taquería Los Chilangos, Taquería Revolución

**Restaurante / bar (revisar) (8):** Agrotaberna, Ahorita Cantina, Botanero del Bosque, La Taberna de Miguel, La Taberna del León, Marisquería Bar La Mony, Mou's Original Bar B Que, Sinaloa Seafood - Grill & Cantina

**Restaurante japonés (revisar) (7):** Barrita de Sushi, Deigo Sushi - Insurgentes, Jin San Shabu Shabu - Santa Fe, Kumoto Robatayaki, Teppan Grill- Hyatt Regency Mexico City, Wa Teppan & Sushi Bar - Santa Fe, Wabi Sushi

**Club / espacio de baile (validar) (7):** Janis Palmas, Kennedy Social Club, La Santa, M.R. Bar Club, Sens, The Grand Hotel Club, U.T.A. Bar

**Ramen / restaurante (6):** Deigo Ramen, Manpuku Ramen, Mukyu Ramen, Oscuro Ramen, The Ramen House, Yamasan Ramen House

**Mariscos / restaurante (4):** El Oyster Club, Fisher´s House - Pabellon Bosques, King Fish - Santa Fe, Puerto Viejo Mariscos - Río Lerma

**Museo (4):** MUAC, Museo Universitario de Arte Contemporáneo, Museo de la Medicina Mexicana, Museo Diego Rivera Anahuacalli, Yancuic Museo Interactivo Infantil y Juvenil

**Pizzería / restaurante (3):** Coppola Pizza Vynil Bar, Dr. Pizza - Condesa, Rita la pizza fritta

**Escape room (3):** Enigma Rooms Bosques de las Lomas, Escape 60', Escape Rooms México

**Arquitectura / biblioteca (2):** Biblioteca de México, La Ciudadela, Biblioteca Vasconcelos

**Zona arqueológica (1):** Zona Arqueológica de Tlatelolco

**Cine (1):** Le Cinéma IFAL

**Lucha libre / espectáculo (1):** Arena México

**Centro cultural (1):** Casa del Lago UNAM

**Pintura de cerámica (1):** Clayzie

**Taller creativo (1):** Luaa Estudio de Cerámica

**Taller de cerámica (1):** Casa Taller, Petén 434

## Ya existentes (131)

- Alameda Central → Alameda Central (cdmx-0132)
- Almanegra Café → Almanegra Café (cdmx-2207)
- Amaya → Amaya (cdmx-2188)
- Arena Coliseo → Arena Coliseo (cdmx-0130)
- Asador Nerón → Asador Nerón (cdmx-4008)
- Auditorio Nacional → Auditorio Nacional (cdmx-2144)
- Aztlán Parque Urbano → Aztlán Parque Urbano (cdmx-2069)
- Azul Histórico → Azul Histórico (cdmx-2059)
- Belfiore → Belfiore (cdmx-4035)
- Blanco Colima → Blanco Colima (cdmx-2186)
- Bosque de Chapultepec → Bosque de Chapultepec (cdmx-0124)
- Bosque de San Juan de Aragón → Bosque de San Juan de Aragón (cdmx-2148)
- Butcher & Sons Roma → Butcher & Sons · Roma (cdmx-4028)
- Cabrera 7 → Cabrera 7 (cdmx-2182)
- Café Arixi → Café Arixi (cdmx-0054)
- Café Nin → Café Nin (nin)
- Campomar - Mitikah → Campomar · Mitikah (cdmx-4003)
- Carmela y Sal → Carmela y Sal (cdmx-2043)
- Casa Prunes → Casa Prunes (prunes)
- Catch → Catch (cdmx-4014)
- Cerámica Libertad → Cerámica Libertad (cdmx-3031)
- Churrería el Moro → Churrería El Moro (elmoro)
- Cine Tonalá → Cine Tonalá (cdmx-0600)
- Cluny → Cluny (cdmx-2081)
- Comedor Jacinta → Comedor Jacinta (cdmx-2196)
- Complejo Cultural Los Pinos → Complejo Cultural Los Pinos (cdmx-0183)
- Contramar → Contramar (contramar)
- Corazón de Maguey → Corazón de Maguey (cdmx-2071)
- Cursi → Cursi (cdmx-4022)
- El Cardenal → El Cardenal (cdmx-2060)
- El Mekong → El Mékông (cdmx-4016)
- El Parnita → El Parnita (cdmx-2016)
- El Pialadero de Guadalajara → El Pialadero de Guadalajara (cdmx-2055)
- El Turix → El Turix (cdmx-0077)
- El Vilsito → El Vilsito (cdmx-0076)
- Em → Em (cdmx-2013)
- Enigma Rooms Coyoacán → Enigma Rooms Coyoacán (cdmx-3012)
- Eno → Eno · Polanco (cdmx-2040)
- Entremar → Entremar (cdmx-2039)
- Er Rre un Bistró → Er Rre un Bistró (cdmx-2218)
- Expendio de Maíz → Expendio de Maíz (expendio)
- Fifty Mils → Fifty Mils (cdmx-2166)
- Filomeno → Filomeno (cdmx-4007)
- Fonda Fina → Fonda Fina (cdmx-2184)
- Fónico → Fónico (cdmx-4023)
- Fünk Club → Fünk Club (cdmx-2175)
- Galanga Thai House → Galanga Thai House (cdmx-0073)
- Guria - Santa Fe → Guria · Santa Fe (cdmx-2117)
- Handshake Speakeasy → Handshake Speakeasy (handshake)
- Havre 77 → Havre 77 (cdmx-2189)
- Hiya Wine Bar → Hiya Wine Bar (cdmx-4009)
- ICHIKANI - ARCOS → Ichikani · Arcos Bosques (cdmx-4029)
- Instituto del Derecho de Asilo Museo Casa de León Trotsky → Instituto del Derecho de Asilo Museo Casa de León Trotsky (cdmx-0708)
- Kaito del Valle → Kaito Del Valle (kaito)
- La Casa Luis Barragán → La Casa Luis Barragán (cdmx-0495)
- La Docena → La Docena · Roma (cdmx-2015)
- La Imperial - Samara → La Imperial · Samara (cdmx-2114)
- Lalo! → Lalo! (cdmx-2217)
- Lardo → Lardo (cdmx-2030)
- Limosneros → Limosneros (cdmx-2061)
- Los Danzantes Coyoacán → Los Danzantes · Coyoacán (cdmx-2070)
- Loup Bar → Loup Bar (cdmx-2187)
- M.N. Roy → M.N. Roy (cdmx-2024)
- Magazzino → Magazzino (cdmx-0043)
- Maison Artemisia → Maison Artemisia (cdmx-4064)
- Mandolina - Polanco → Mandolina · Polanco (cdmx-4015)
- Masala y Maiz → Masala y Maíz (cdmx-2183)
- Maza bistrot → Maza Bistrot (cdmx-0069)
- Meroma → Meroma (cdmx-0068)
- Merotoro → Merotoro (cdmx-2031)
- Museo Banco de México → Museo Banco de México (cdmx-0422)
- Museo de El Carmen → Museo de El Carmen (cdmx-0021)
- Museo de Geología → Museo de Geología (cdmx-0391)
- Museo de Historia Natural y Cultura Ambiental → Museo de Historia Natural y Cultura Ambiental (cdmx-0390)
- Museo de la Ciudad de México → Museo de la Ciudad de México (cdmx-0383)
- Museo del Estanquillo → Museo del Estanquillo (cdmx-0144)
- Museo del Metro → Museo del Metro (cdmx-0759)
- Museo del Objeto del Objeto (MODO) → Museo del Objeto del Objeto (MODO) (cdmx-0143)
- Museo del Palacio de Bellas Artes → Museo del Palacio de Bellas Artes (cdmx-0142)
- Museo del Perfume. MUPE → Museo del Perfume MUPE (cdmx-0373)
- Museo del Templo Mayor → Museo del Templo Mayor (cdmx-0005)
- Museo Experimental El Eco → Museo Experimental El Eco (cdmx-0415)
- Museo Franz Mayer → Museo Franz Mayer (cdmx-0164)
- Museo Frida Kahlo → Museo Frida Kahlo (cdmx-0200)
- Museo Interactivo de Economía (MIDE) → Museo Interactivo de Economía (MIDE) (cdmx-0410)
- Museo Jumex → Museo Jumex (jumex)
- Museo Kaluz → Museo Kaluz (cdmx-0407)
- Museo Memoria y Tolerancia → Museo Memoria y Tolerancia (cdmx-0162)
- Museo Mural Diego Rivera → Museo Mural Diego Rivera (cdmx-0403)
- Museo Nacional de Antropología (MNA) → Museo Nacional de Antropología (MNA) (cdmx-0161)
- Museo Nacional de Culturas Populares → Museo Nacional de Culturas Populares (cdmx-0199)
- Museo Nacional de la Acuarela Alfredo Guati Rojo → Museo Nacional de la Acuarela Alfredo Guati Rojo (cdmx-0198)
- Museo Nacional de la Vivienda (MUNAVI) → Museo Nacional de la Vivienda (Munavi) (cdmx-0223)
- Museo Nacional de las Intervenciones → Museo Nacional de las Intervenciones (cdmx-0006)
- Museo Nacional de San Carlos → Museo Nacional de San Carlos (cdmx-0157)
- Museo Soumaya Plaza Carso → Museo Soumaya, Plaza Carso (cdmx-0151)
- Negroni - Arcos Bosques → Negroni · Arcos Bosques (cdmx-2109)
- Negroni - Artz → Negroni · Artz (cdmx-2158)
- Nicos → Nicos (cdmx-2178)
- Niddo → Niddo (cdmx-2051)
- Nobu -Polanco → Nobu · Polanco (cdmx-2123)
- Olaf → Olaf (cdmx-4019)
- Pan Comido → Pan Comido (cdmx-2029)
- Papalote Museo del Niño Chapultepec → Papalote Museo del Niño Chapultepec (cdmx-0139)
- Parque Bicentenario → Parque Bicentenario (cdmx-2149)
- Parque de los Venados → Parque de los Venados (cdmx-0094)
- Parque La Mexicana → Parque La Mexicana (cdmx-0097)
- Parque Lincoln → Parque Lincoln (cdmx-0096)
- Parque Lira → Parque Lira (cdmx-2211)
- Parque Masayoshi Ohira → Parque Masayoshi Ohira (cdmx-2212)
- Parque México → Parque México (cdmx-0095)
- Patrick Miller → Patrick Miller (cdmx-2022)
- Piazza Pasticcio → Piazza Pasticcio (cdmx-0040)
- Pizza Félix → Pizza Félix (cdmx-2191)
- Propio → Propio (cdmx-0037)
- Pujol → Pujol (cdmx-0002)
- Páramo → Páramo (cdmx-2017)
- Quintonil → Quintonil (cdmx-0001)
- Raíz → Raíz (cdmx-4020)
- Rosa Negra Polanco → Rosa Negra · Polanco (cdmx-2042)
- Rosetta → Rosetta (cdmx-2012)
- San Ángel Inn → San Ángel Inn (cdmx-2079)
- Sartoria → Sartoria (cdmx-2014)
- Six Flags México → Six Flags México (cdmx-2091)
- Sud 777 → Sud 777 (cdmx-2177)
- Taller de Ostiones → Taller de Ostiones (cdmx-4006)
- Teatro de la Ciudad Esperanza Iris → Teatro de la Ciudad Esperanza Iris (cdmx-0135)
- Terraza Cha Cha Cha → Terraza Cha Cha Chá (chachacha)
- The Midnight Monkey → The Midnight Monkey (cdmx-4062)
- Umai → Umai (cdmx-4012)
- Universum Museo de las Ciencias → Universum Museo de las Ciencias (cdmx-0193)

## Siguiente paso sugerido

1. Resolver las 29 sucursales nuevas: ya conocemos la marca, sólo falta dirección, horario y precio de esa sede.
2. Revisar a mano los 39 posibles duplicados (alias y sedes reales, como Cineteca Nacional Xoco vs. Chapultepec).
3. Para los nuevos, completar primero los que cubren huecos reales por zona y por papel (desayuno, café, cultura de tarde), en lotes chicos, con fuente y fecha por campo.
