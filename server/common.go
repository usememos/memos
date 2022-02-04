package server

func composeResponse(data interface{}) interface{} {
	type R struct {
		Data interface{} `json:"data"`
	}

	return R{
		Data: data,
	}
}
