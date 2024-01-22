#!/usr/bin/env node
require('colors')
const { program } = require('commander');
var template = require('art-template');
require.extensions['.art'] = template.extension;  // load `.art` file art-template 加载模板文件
const fs = require('fs')
const path = require('path');
const { create_error_table, init_db_pool, query, parse_comment } = require('./scr/db');

let class_tmpl = null;


async function main() {
    const option = init_cli()
    init_db_pool(option.config)
    await create_error_table()

    var outputDir = path.resolve(option.outputDir)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    class_tmpl = require(option.template ? path.resolve(option.template) : path.join(__dirname, 'templates/class.art'));

    let tables = await query(
        `SELECT t.table_name, pg_catalog.obj_description(pgc.oid, 'pg_class') as comment 
        FROM information_schema.tables t INNER JOIN pg_catalog.pg_class pgc 
        ON t.table_name = pgc.relname 
        WHERE t.table_type='BASE TABLE' AND t.table_schema='public' ${option.table ? "AND t.table_name=:table_name;" : ''};`, { table_name: option.table });

    for (let t in tables) {
        const { table_name, comment } = tables[t]
        const class_name = parse_comment(comment)["class_name"]
        const dt_fields = await query(`select column_name from information_schema.columns where table_name = :table_name;`, { table_name });

        let html = class_tmpl({  // 根据模板生成代码
            table_name,
            dt_fields,
            class_name: class_name ?? table_name,
            comment
        })

        fs.writeFileSync(path.join(outputDir, `${table_name}.js`), html)  // 保存

    }


}

main().then(() => {
    console.log("done!".green);
    process.exit(0)
})

/**
 * 
 * @returns {{config, option, outputDir}}
 */
function init_cli() {
    program.name('pg2class')
        .description("CLI tools to generate JS class from postgresql")
        .version('0.0.1')

    // 参数的缩写，全称 [是否可选]，描述以及默认值
    program.option('-c, --config [config.json]', "path of configuration file, which includes sql connection parameter, in JSON format", 'config.json')
    program.option('-o, --output-dir [output]', "output directory", 'output')
    program.option('-t, --table [data_table]', "target table name, for all tables if not specifed")
    program.option('--template [template]', "specify your own template")

    program.parse()
    const option = program.opts()



    return option
}

