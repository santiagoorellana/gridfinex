
/**
 * Bot para operar futuros en el exchange Bitfinex con estrategia de malla.
 * version: 1.0
 * author: Santiago A. Orellana Perez
 * created: 27/abril/2023
 * tested: 'Node 16.13.1
 */

const fs = require('fs');
const ccxtpro = require ('ccxt').pro;
const chalk = require('chalk');


const BASE_DIRECTORY = "./";
const CONFIGURATION_FILE_NAME = BASE_DIRECTORY + "config.json";
const EXAMPLE_CONFIGURATION_FILE_NAME = BASE_DIRECTORY + "example_config.json";
const LOG_FILE_NAME = BASE_DIRECTORY + "report.log";

const CONFIGURATION_TEMPLATE = {
    baseCurrency: 'BTCF0',	    // Identificador de la currency base que se desea comprar y vender.
    quoteCurrency: 'USTF0',     // Identificador de la currency quote que sirve de cuantificador.
    centralPrice: 29000,        // Precio en quote a partir del cual se hace la distribución de los niveles de compra y venta.
    amountAsQuote: 2.0,	        // Cantidad de currency quote que desea comerciar en cada operacion de compra o venta.
    upperLevelsCount: 20,		// Cantidad de niveles por encima del precio central.
    downLevelsCount: 20,		// Cantidad de niveles por debajo del precio central.
    interLevelsDelta: 200       // Distancia en quote entre los niveles de compra y venta.
}

/**
 * Verifica si los datos de configuración están completos. 
 * @param {*} configuration - Objeto JSON con los parámetros de configuración.
 * @returns - true si están todos los parámetros, de lo contrario false. 
 */
function completedConfiguration(configuration){
    let result = true;
    Object.keys(CONFIGURATION_TEMPLATE).forEach(key => {
        if (! configuration.hasOwnProperty(key)){
            console.log(chalk.red('Falta el parámeto '+key+' en el fichero de configuración.'));
            result = false;
        }
    });
    return result;
}


/**
 * Muestra los datos de configuración cargados.
 * @param {*} configuration - Objeto JSON con los parámetros de configuración.
 */
function showConfiguration(configuration){
    console.log(chalk.cyan("\nLa configuración actual es la siguiente:\n"));
    Object.keys(configuration).forEach(key => {
        console.log(chalk.cyan(key + ": "), chalk.whiteBright(configuration[key]));
    });
}


function fileExists(path) {
    try{
        return fs.statSync(path).isFile();
    }catch(e){
        return false;
    }
}


/**
 * Carga de los datos de configuración desde un fichero. 
 * Si el fichero no existe, crea uno nuevo y termina el programa.
 * Si existe, carga los datos y le pregunta el usuario si desea continuar.
 */
function prepareConfiguration(){
    console.log(chalk.cyan("Cargando configuración del bot..."));
    if (fileExists(CONFIGURATION_FILE_NAME)){
        const file = fs.readFileSync(CONFIGURATION_FILE_NAME, 'utf-8');        
        configurationParameters = JSON.parse(file);
        if (completedConfiguration(configurationParameters)){
            showConfiguration(configurationParameters);
            userResponse = 'si';   //input("\n¿Desea continuar con la fonfiguracion actual? (si/no):")
            if (userResponse.toLowerCase() == 'si'){
                return configurationParameters;
            }else{
                return null;
            }
        }else{
            //input(chalk.red("No se puede continuar.\nPresione la tecla Enter para terminar"));
            console.log(chalk.red("No se puede continuar.\nPresione la tecla Enter para terminar"));
            return null;
        }
    }else{
        let template = JSON.stringify(CONFIGURATION_TEMPLATE, null, 4);
        fs.writeFileSync(CONFIGURATION_FILE_NAME, template);
        console.log("No se encontró el fichero de configuracion: "+CONFIGURATION_FILE_NAME+
            "\nYa ha sido creado y usted debe revisarlo antes de volver a ejecutar el programa.");
        //input("Presione la tecla Enter para terminar")
        return null;
    }
}


/**
 * Calcula los niveles de compra y venta del grid bot.
 * Los parametros ya están explicados en el inicio del fichero.
 */
function createGridLevels(centralPrice, interLevelsDelta, upperLevelsCount, downLevelsCount){
    const totalLevels = Number(upperLevelsCount) + Number(downLevelsCount) + 1;
    const minLevelPrice = Number(centralPrice) - (Number(interLevelsDelta) * Number(downLevelsCount));
    let levels = [];
    eval("levels.push(0);".repeat(totalLevels));
    levels.forEach((level, index) => {
        levels[index] = Number(minLevelPrice) + (Number(index) * Number(interLevelsDelta));
    });        
    return levels;
}


/**
 * Muestra los niveles de compra y venta del grid bot.
 * @param {*} levels - Lista con los niveles que se han calculado.
 * @param {*} parameters - Parametros con los que se está trabajando.
 */
function showGridLevels(levels, parameters){
    console.log(chalk.cyan("\nLos niveles de compra y venta establecidos son los siguientes:\n"));
    console.log(chalk.whiteBright(levels + "\n"));
    console.log(chalk.cyan("Nivel máximo:"), chalk.whiteBright(levels[levels.length - 1]), parameters.quoteCurrency);
    console.log(chalk.cyan("Nivel mínimo:"), chalk.whiteBright(levels[0]), parameters.quoteCurrency);
}


async function main(){
    console.log(chalk.cyanBright("\n<<<<<< Bitfinex Future Grid >>>>>>"));
    console.log(chalk.cyan("Bot para operar futuros en el exchange Bitfinex con estrategia de malla.\n"));

    let parameters = prepareConfiguration();
    if (parameters == null) return;
    
    let symbol = parameters.baseCurrency +"/"+ parameters.quoteCurrency;
    let levels = createGridLevels(
        parameters.centralPrice, 
        parameters.interLevelsDelta, 
        parameters.upperLevelsCount, 
        parameters.downLevelsCount
    );
    showGridLevels(levels, parameters);
    userResponse = 'si';  //input("\n¿Desea continuar con los niveles de compra y venta establecidos? (si/no):")
    if (userResponse.toLowerCase() == 'no') return;
    
    let exchange = new ccxtpro.bitfinex({'newUpdates': false});    //From Cuba: No VPN: kucoin, hitbtc, VPN: bitfinex, kraken, binance ...
    console.log(chalk.cyan("\nRecibiendo datos del exchange "+exchange.name+"..."));
    if (exchange.has['watchTicker']){
        let previousPrice = 0;
        let error = false;
        while (true){
            try{
                let tickers = await exchange.watch_ticker(symbol);
                let dateTime = exchange.iso8601(exchange.milliseconds());
                let lastPrice = tickers.last;
                if (Number(Number(lastPrice) - Number(previousPrice)) >= 0){
                    console.log(chalk.cyan(dateTime), chalk.green(lastPrice), parameters.quoteCurrency);
                }else{
                    console.log(chalk.cyan(dateTime), chalk.red(lastPrice), parameters.quoteCurrency);
                }
                previousPrice = lastPrice;
                error = false;
            }catch(e){
                if (! error){
                    console.log(chalk.redBright(e));
                    console.log(chalk.red("Esperando..."));
                }
                error = true;
            }
        }
    }else{
        console.log(chalk.red("El exchange "+exchange.name+" no soporta suscripción mediante watchTickers."
            +"\nContacte con el programador en tecnochago@gmail.com"));
    }
}


main();
