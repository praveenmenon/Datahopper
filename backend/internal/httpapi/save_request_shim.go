package httpapi

import "github.com/jackc/pgx/v5/pgxpool"

// ApiRunnerPoolSet sets the package-level pool for save-request handler
func ApiRunnerPoolSet(p *pgxpool.Pool) {
    apiRunnerPool = p
}



