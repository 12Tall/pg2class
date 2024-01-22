

const path = require('path');
const { Pool } = require('pg');
const format = require('yesql').pg
let pgPool = null;

/**
 * return:  
 *   - array: query successully  
 *   - false: there is an error
 * @param {string} sql 
 * @param {Array<any>} values 
 * @returns {Array<any>|false} 
 */
async function query(sql, values) {
    let res = false
    const pool = await getPool();
    const client = await pool.connect();
    try {
        const query_params = format(sql, { useNullForMissing: true })(values)
        const { rows } = await client.query(query_params);
        res = rows;
    } catch (e) {
        await client.query(`INSERT INTO public.sys_error(err_type, err_content, err_message) VALUES (:err_type, :err_content, :err_message);`, { err_type: "sql", err_content: JSON.stringify({ sql, values }), err_message: e.message });
        console.log(`${e.message}`.red);
    } finally {
        client.release();
        return res;
    }
}

function init_db_pool(config_file) {
    const cfg = require(path.resolve(config_file))
    pgPool = new Pool(cfg)
}
function getPool() {
    return pgPool;
}



async function create_error_table() {
    const pool = await getPool();
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS public.sys_error(id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),created_time timestamp without time zone NOT NULL DEFAULT now(),updated_time timestamp without time zone NOT NULL DEFAULT now(),removed_time timestamp without time zone,err_type character varying(20) COLLATE pg_catalog."default" NOT NULL,err_content text COLLATE pg_catalog."default" NOT NULL,err_message text COLLATE pg_catalog."default" NOT NULL,CONSTRAINT sys_error_pkey PRIMARY KEY (id))TABLESPACE pg_default;`)

    } catch (e) {
        console.log(`can not create error table: ${e.message}`.red);
    } finally {
        client.release();
    }
}

function parse_comment(str){
    let res = false
    try{
        res = JSON.parse(str)
        if(typeof(res) == "object"){
            return res
        }
    }catch(e){
        return false
    }
}

module.exports = {
    query,
    init_db_pool,
    create_error_table,
    getPool,
    parse_comment
}